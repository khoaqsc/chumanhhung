import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  LogOut, 
  Type as TypeIcon, 
  Palette, 
  Minus, 
  Plus, 
  Sparkles, 
  Info, 
  HelpCircle, 
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Users,
  Shield,
  ChevronDown,
  AlertTriangle,
  X,
  Database,
  ExternalLink
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { cn } from '../../utils/firestore';
import { db, auth } from '../../firebase';
import { 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  updateDoc,
  query,
  where 
} from 'firebase/firestore';
import { FAMILY_TREE_ID } from '../../constants';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';

export const SettingsScreen = () => {
  const { 
    fontSettings, setFontSettings, 
    members, 
    hiddenGenerations, setHiddenGenerations,
    hiddenMemberIds, setHiddenMemberIds,
    isAdmin,
    showToast,
    user
  } = useFirebase();

  const [expandedGen, setExpandedGen] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [staticInfo, setStaticInfo] = useState<{exists: boolean, updatedAt?: string} | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/static-info')
      .then(res => res.json())
      .then(data => setStaticInfo(data))
      .catch(() => setStaticInfo({ exists: false }));
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      
      // Create/Update user document
      const userDocRef = doc(db, 'users', loggedUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          name: loggedUser.displayName,
          email: loggedUser.email,
          role: loggedUser.email === 'chubatien1986@gmail.com' ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        });
      }
      
      showToast('Đăng nhập thành công!', 'success');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        showToast('Lỗi: Tên miền này chưa được cấp phép trong Firebase.', 'error');
      } else if (error.code === 'auth/popup-blocked') {
        showToast('Lỗi: Trình duyệt đã chặn cửa sổ đăng nhập.', 'error');
      } else {
        showToast('Đăng nhập thất bại. Vui lòng thử lại.', 'error');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Đã đăng xuất.', 'info');
    } catch (error) {
      showToast('Lỗi khi đăng xuất.', 'error');
    }
  };

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleMigrateData = async () => {
    if (!isAdmin) return;
    setIsDeleting(true);
    try {
      let count = 0;
      
      const membersSnap = await getDocs(collection(db, 'members'));
      for (const d of membersSnap.docs) {
        if (!d.data().familyTreeId) {
          await updateDoc(doc(db, 'members', d.id), { familyTreeId: FAMILY_TREE_ID });
          count++;
        }
      }
      
      const eventsSnap = await getDocs(collection(db, 'events'));
      for (const d of eventsSnap.docs) {
        if (!d.data().familyTreeId) {
          await updateDoc(doc(db, 'events', d.id), { familyTreeId: FAMILY_TREE_ID });
          count++;
        }
      }
      
      const gravesSnap = await getDocs(collection(db, 'graveLocations'));
      for (const d of gravesSnap.docs) {
        if (!d.data().familyTreeId) {
          await updateDoc(doc(db, 'graveLocations', d.id), { familyTreeId: FAMILY_TREE_ID });
          count++;
        }
      }
      
      showToast(`Đã cập nhật ${count} bản ghi sang ID: ${FAMILY_TREE_ID}`, 'success');
    } catch (error: any) {
      console.error("Migration error:", error);
      if (error.message?.includes('Quota exceeded')) {
        showToast('Đã hết giới hạn lượt đọc miễn phí hôm nay (50k lượt). Vui lòng thử lại vào ngày mai hoặc xuất bản JSON để dùng offline.', 'error');
      } else {
        showToast('Lỗi khi di chuyển dữ liệu.', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublishStatic = async () => {
    if (!isAdmin) return;
    setIsPublishing(true);
    try {
      showToast('Đang thu thập dữ liệu từ Firebase...', 'info');
      
      // Fetch ALL data for this tree
      const qMembers = query(collection(db, 'members'), where('familyTreeId', '==', FAMILY_TREE_ID));
      const qEvents = query(collection(db, 'events'), where('familyTreeId', '==', FAMILY_TREE_ID));
      const qGraves = query(collection(db, 'graveLocations'), where('familyTreeId', '==', FAMILY_TREE_ID));
      
      const [membersSnap, eventsSnap, gravesSnap] = await Promise.all([
        getDocs(qMembers),
        getDocs(qEvents),
        getDocs(qGraves)
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        familyTreeId: FAMILY_TREE_ID,
        members: membersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        events: eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        graves: gravesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };

      const resp = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await resp.json();
      if (result.success) {
        showToast(result.message, 'success');
        setStaticInfo({ exists: true, updatedAt: new Date().toISOString() });
      } else {
        showToast(result.message || 'Lỗi từ máy chủ khi xuất bản.', 'error');
      }
    } catch (error: any) {
      console.error("Publish error:", error);
      if (error.message?.includes('Quota exceeded')) {
        showToast('Không thể xuất bản vì đã hết lượt đọc Firebase hôm nay. Vui lòng quay lại vào ngày mai.', 'error');
      } else {
        showToast(`Lỗi: ${error.message || 'Không thể kết nối tới máy chủ.'}`, 'error');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const fontFamilies = [
    'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Playfair Display', 'Lora', 'Merriweather'
  ];

  const effects = [
    { id: 'none', label: 'Không có' },
    { id: 'glow', label: 'Phát sáng' },
    { id: 'shadow', label: 'Đổ bóng' },
    { id: 'blink', label: 'Nhấp nháy' },
  ];

  const allGenerations: number[] = useMemo(() => {
    const gens = members.map(m => Number(m.generation)).filter(gen => !isNaN(gen));
    const uniqueGens: number[] = Array.from(new Set(gens));
    return uniqueGens.sort((a, b) => a - b);
  }, [members]);

  const toggleGeneration = (gen: number) => {
    setHiddenGenerations(
      hiddenGenerations.includes(gen) 
        ? hiddenGenerations.filter(g => g !== gen) 
        : [...hiddenGenerations, gen]
    );
  };

  const toggleMember = (id: string) => {
    setHiddenMemberIds(
      hiddenMemberIds.includes(id)
        ? hiddenMemberIds.filter(mId => mId !== id)
        : [...hiddenMemberIds, id]
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 pb-24">
      <header className="mt-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-modern-900">Cài đặt</h1>
          <p className="text-modern-500 text-sm">Tùy chỉnh ứng dụng của bạn</p>
        </div>
      </header>

      <div className="space-y-4">
        {/* Section: Access & Data */}
        <div className="glass-card rounded-3xl overflow-hidden border border-modern-100 shadow-sm">
          <button 
            onClick={() => toggleSection('access')}
            className="w-full flex items-center justify-between p-6 hover:bg-modern-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-500 rounded-xl">
                <Shield size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-modern-900">Quyền truy cập & Dữ liệu</p>
                <p className="text-[10px] text-modern-400 font-medium">Quản lý quyền và hiển thị thành viên</p>
              </div>
            </div>
            <ChevronDown size={20} className={cn("text-modern-400 transition-transform", openSection === 'access' && "rotate-180")} />
          </button>

          <AnimatePresence>
            {openSection === 'access' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-modern-50"
              >
                <div className="p-6 space-y-6">
                  {/* Admin Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isAdmin ? "bg-blue-100 text-blue-600" : "bg-modern-100 text-modern-400"
                      )}>
                        {isAdmin ? <ShieldCheck size={20} /> : <Lock size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-modern-900">{isAdmin ? 'Chế độ Quản trị viên' : 'Chế độ Người xem'}</p>
                        <p className="text-[9px] text-modern-400 font-medium">
                          {isAdmin ? 'Cho phép thêm, sửa, xóa thông tin' : 'Chỉ được phép xem thông tin'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-wider">
                        Đã xác thực
                      </div>
                    )}
                  </div>

                  {/* Visibility Settings */}
                  {isAdmin && (
                    <div className="space-y-4 pt-4 border-t border-modern-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-modern-400" />
                          <span className="text-xs font-bold">Ẩn/Hiện thành viên các đời</span>
                        </div>
                        <button 
                          onClick={() => {
                            setHiddenGenerations([]);
                            setHiddenMemberIds([]);
                          }}
                          className="text-[9px] font-bold text-blue-600 uppercase hover:underline"
                        >
                          Hiện tất cả
                        </button>
                      </div>

                      <div className="space-y-2">
                        {allGenerations.map(gen => {
                          const isGenHidden = hiddenGenerations.includes(gen);
                          const genMembers = members.filter(m => Number(m.generation) === gen);
                          const isExpanded = expandedGen === gen;

                          return (
                            <div key={gen} className="space-y-2">
                              <div className={cn(
                                "flex items-center justify-between p-3 rounded-2xl border transition-all",
                                isGenHidden ? "bg-modern-50 border-modern-100" : "bg-white border-modern-200 shadow-sm"
                              )}>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => toggleGeneration(gen)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-colors",
                                      isGenHidden ? "text-modern-300" : "text-blue-500 bg-blue-50"
                                    )}
                                  >
                                    {isGenHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <span className={cn("text-[11px] font-bold", isGenHidden ? "text-modern-400" : "text-modern-900")}>
                                    Đời thứ {gen}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => setExpandedGen(isExpanded ? null : gen)}
                                  className="p-1 text-modern-400 hover:bg-modern-50 rounded-lg transition-colors"
                                >
                                  <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                                </button>
                              </div>

                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="grid grid-cols-1 gap-2 pl-4"
                                >
                                  {genMembers.map(member => {
                                    const isMemberHidden = hiddenMemberIds.includes(member.id);
                                    return (
                                      <button
                                        key={member.id}
                                        onClick={() => toggleMember(member.id)}
                                        className={cn(
                                          "flex items-center justify-between p-2.5 rounded-xl border text-[10px] font-medium transition-all",
                                          isMemberHidden || isGenHidden
                                            ? "bg-modern-50/50 border-modern-100 text-modern-300" 
                                            : "bg-white border-modern-100 text-modern-700 shadow-sm"
                                        )}
                                      >
                                        <span className="flex items-center gap-2">
                                          <div className={cn(
                                            "w-1 h-1 rounded-full",
                                            member.gender === 'Nữ' ? "bg-pink-400" : "bg-blue-400"
                                          )} />
                                          {member.name}
                                        </span>
                                        {isMemberHidden || isGenHidden ? <EyeOff size={10} /> : <CheckCircle2 size={10} className="text-green-500" />}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Firebase Console Link */}
                      <div className="pt-4 border-t border-modern-50 space-y-3">
                        <div className="flex items-center gap-2">
                          <Database size={16} className="text-blue-500" />
                          <span className="text-xs font-bold text-modern-900">Quản lý cơ sở dữ liệu</span>
                        </div>
                        <a 
                          href="https://console.firebase.google.com/project/gen-lang-client-0039226845/firestore/databases/ai-studio-444b2d26-74db-4a8d-98cf-59014ef15dbb/data"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl text-[10px] font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <ExternalLink size={12} /> Mở Firebase Console
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section: UI & Fonts */}
        <div className="glass-card rounded-3xl overflow-hidden border border-modern-100 shadow-sm">
          <button 
            onClick={() => toggleSection('ui')}
            className="w-full flex items-center justify-between p-6 hover:bg-modern-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 text-pink-500 rounded-xl">
                <Palette size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-modern-900">Giao diện & Phông chữ</p>
                <p className="text-[10px] text-modern-400 font-medium">Tùy chỉnh kiểu chữ và màu sắc</p>
              </div>
            </div>
            <ChevronDown size={20} className={cn("text-modern-400 transition-transform", openSection === 'ui' && "rotate-180")} />
          </button>

          <AnimatePresence>
            {openSection === 'ui' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-modern-50"
              >
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <TypeIcon size={16} className="text-modern-400" />
                      <span className="text-xs font-bold">Kiểu chữ tiêu đề</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fontFamilies.map(f => (
                        <button 
                          key={f}
                          onClick={() => setFontSettings({ ...fontSettings, family: f })}
                          className={cn(
                            "p-2.5 rounded-xl border text-[10px] font-medium transition-all",
                            fontSettings.family === f 
                              ? "bg-modern-900 text-white border-modern-900" 
                              : "bg-modern-50 text-modern-600 border-modern-100 hover:border-modern-300"
                          )}
                          style={{ fontFamily: f }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-modern-50">
                    <div className="flex items-center gap-3">
                      <Palette size={16} className="text-modern-400" />
                      <span className="text-xs font-bold">Kích thước & Màu sắc</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-modern-500">Cỡ chữ (Gia Phả)</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setFontSettings({...fontSettings, size: Math.max(10, fontSettings.size - 1)})} className="p-1 bg-modern-100 rounded-lg"><Minus size={12}/></button>
                          <span className="text-xs font-bold w-6 text-center">{fontSettings.size}</span>
                          <button onClick={() => setFontSettings({...fontSettings, size: Math.min(30, fontSettings.size + 1)})} className="p-1 bg-modern-100 rounded-lg"><Plus size={12}/></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-modern-500">Cỡ chữ (Dòng họ)</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setFontSettings({...fontSettings, titleSize: Math.max(10, fontSettings.titleSize - 1)})} className="p-1 bg-modern-100 rounded-lg"><Minus size={12}/></button>
                          <span className="text-xs font-bold w-6 text-center">{fontSettings.titleSize}</span>
                          <button onClick={() => setFontSettings({...fontSettings, titleSize: Math.min(40, fontSettings.titleSize + 1)})} className="p-1 bg-modern-100 rounded-lg"><Plus size={12}/></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-modern-500">Màu sắc chính</span>
                        <input 
                          type="color" 
                          value={fontSettings.color}
                          onChange={(e) => setFontSettings({...fontSettings, color: e.target.value})}
                          className="w-6 h-6 rounded-lg overflow-hidden border-none cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-modern-500">Màu sắc phụ</span>
                        <input 
                          type="color" 
                          value={fontSettings.titleColor}
                          onChange={(e) => setFontSettings({...fontSettings, titleColor: e.target.value})}
                          className="w-6 h-6 rounded-lg overflow-hidden border-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-modern-50">
                    <div className="flex items-center gap-3">
                      <Sparkles size={16} className="text-modern-400" />
                      <span className="text-xs font-bold">Hiệu ứng chữ</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {effects.map(e => (
                        <button 
                          key={e.id}
                          onClick={() => setFontSettings({ ...fontSettings, effect: e.id as any })}
                          className={cn(
                            "p-2.5 rounded-xl border text-[10px] font-medium transition-all",
                            fontSettings.effect === e.id 
                              ? "bg-modern-900 text-white border-modern-900" 
                              : "bg-modern-50 text-modern-600 border-modern-100 hover:border-modern-300"
                          )}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section: App Info */}
        {isAdmin && (
          <div className="glass-card rounded-3xl overflow-hidden border border-modern-100 shadow-sm">
            <button 
              onClick={() => toggleSection('admin')}
              className="w-full flex items-center justify-between p-6 hover:bg-modern-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-modern-50 text-modern-500 rounded-xl">
                  <Database size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-modern-900">Quản trị dữ liệu</p>
                  <p className="text-[10px] text-modern-400 font-medium">Phân vùng & Di chuyển dữ liệu</p>
                </div>
              </div>
              <ChevronDown size={20} className={cn("text-modern-400 transition-transform", openSection === 'admin' && "rotate-180")} />
            </button>

            <AnimatePresence>
              {openSection === 'admin' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-modern-50"
                >
                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={16} />
                        <span className="text-xs font-bold">Phân vùng dữ liệu</span>
                      </div>
                      <p className="text-[10px] text-amber-600 leading-relaxed">
                        Chức năng này sẽ gán ID <b>{FAMILY_TREE_ID}</b> cho tất cả các bản ghi hiện có chưa có ID. 
                        Điều này giúp tối ưu hóa lượt đọc và hỗ trợ nhiều người xem cùng lúc.
                        <br/>
                        <span className="font-bold text-red-600 uppercase">Chú ý:</span> Việc di chuyển sẽ tiêu tốn nhiều lượt đọc Firebase (1 lượt/bản ghi). Chỉ thực hiện khi còn dư hạn mức.
                      </p>
                      <button 
                        onClick={handleMigrateData}
                        disabled={isDeleting}
                        className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-[11px] font-bold shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {isDeleting ? 'Đang xử lý...' : 'Bắt đầu di chuyển dữ liệu'}
                      </button>
                    </div>

                    <div className="pt-4 border-t border-modern-50 space-y-4">
                      <div className="flex items-center gap-2 text-modern-900">
                        <Database size={16} />
                        <span className="text-xs font-bold">Xuất bản dữ liệu tĩnh (JSON)</span>
                      </div>
                      <p className="text-[10px] text-modern-500 leading-relaxed">
                        Chuyển đổi toàn bộ dữ liệu từ Firebase thành một file JSON tĩnh. 
                        Khi được bật, ứng dụng sẽ đọc từ file này thay vì Firebase, giúp <b>tiết kiệm tối đa chi phí</b> và <b>vượt qua giới hạn lượt đọc</b>.
                      </p>
                      
                      {staticInfo?.exists && (
                        <div className="p-3 bg-modern-50 rounded-xl flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <div className="text-[10px] text-modern-600">
                            <p className="font-bold">Đã có bản phát hành</p>
                            <p>Cập nhật lần cuối: {new Date(staticInfo.updatedAt!).toLocaleString('vi-VN')}</p>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={handlePublishStatic}
                        disabled={isPublishing}
                        className="w-full py-2.5 bg-modern-900 text-white rounded-xl text-[11px] font-bold shadow-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isPublishing ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang xuất bản...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Cập nhật bản phát hành JSON
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="glass-card rounded-3xl overflow-hidden border border-modern-100 shadow-sm">
          <button 
            onClick={() => toggleSection('info')}
            className="w-full flex items-center justify-between p-6 hover:bg-modern-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-modern-50 text-modern-500 rounded-xl">
                <Info size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-modern-900">Thông tin ứng dụng</p>
                <p className="text-[10px] text-modern-400 font-medium">Phiên bản và hỗ trợ</p>
              </div>
            </div>
            <ChevronDown size={20} className={cn("text-modern-400 transition-transform", openSection === 'info' && "rotate-180")} />
          </button>

          <AnimatePresence>
            {openSection === 'info' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-modern-50"
              >
                <div className="p-6 space-y-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-modern-50 p-2 -mx-2 rounded-xl transition-colors"
                    onClick={() => {
                      if (user) {
                        if (window.confirm(`Bạn đang đăng nhập với ${user.email}. Bạn có muốn đăng xuất?`)) {
                          handleLogout();
                        }
                      } else {
                        handleLogin();
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Info size={16} className="text-modern-400" />
                      <span className="text-xs font-medium">Phiên bản</span>
                    </div>
                    <span className="text-[10px] font-bold text-modern-900">2.2.0 {user && "(Admin)"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HelpCircle size={16} className="text-modern-400" />
                      <span className="text-xs font-medium">Trợ giúp & Hỗ trợ</span>
                    </div>
                    <ChevronRight size={14} className="text-modern-300" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
