import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  User, 
  Heart, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Upload, 
  ArrowLeft,
  MapPin,
  Calendar,
  BookOpen,
  Settings,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  getDocsFromCache
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { FAMILY_TREE_ID } from '../../constants';
import { useFirebase } from '../../context/FirebaseContext';
import { cn, handleFirestoreError, fileToBase64 } from '../../utils/firestore';
import { OperationType } from '../../types';

// Moved outside to prevent focus loss on re-render
const MemberFormFields = ({ data, onChange, title, spouses, members }: { data: any, onChange: (val: any) => void, title?: string, spouses?: any[], members: any[] }) => {
  const prevGenMembers = useMemo(() => {
    const prevGen = (parseInt(data.generation) || 1) - 1;
    if (prevGen < 1) return [];
    return members.filter(m => Number(m.generation) === prevGen);
  }, [data.generation, members]);

  const potentialFathers = useMemo(() => prevGenMembers.filter(m => m.gender === 'Nam'), [prevGenMembers]);
  const potentialMothers = useMemo(() => prevGenMembers.filter(m => m.gender === 'Nữ'), [prevGenMembers]);

  return (
    <div className="glass-card rounded-3xl p-5 border border-modern-100 bg-white/80 space-y-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            data.gender === 'Nữ' ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"
          )}>
            {data.gender === 'Nữ' ? <Heart size={14} /> : <User size={14} />}
          </div>
          <h4 className="text-sm font-bold text-modern-900">{title || 'Thông tin'}</h4>
        </div>
        <span className="text-[10px] bg-modern-100 text-modern-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
          Chi tiết
        </span>
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
          <User size={10} /> Họ và tên
        </label>
        <input 
          type="text" 
          className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm font-medium"
          value={data.name || ''}
          onChange={(e) => onChange({...data, name: e.target.value})}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
          <Users size={10} /> Đời thứ
        </label>
        <input 
          type="number" 
          className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
          value={data.generation || ''}
          onChange={(e) => onChange({...data, generation: parseInt(e.target.value) || 1})}
        />
      </div>

      {spouses && spouses.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Heart size={10} /> Mẹ (Vợ thứ...)
          </label>
          <select 
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.motherName || ''}
            onChange={(e) => onChange({...data, motherName: e.target.value})}
          >
            <option value="">-- Chọn mẹ --</option>
            {spouses.map((s, i) => (
              <option key={i} value={s.name}>{s.name} (Vợ {i + 1})</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Edit2 size={10} /> Danh hiệu
          </label>
          <input 
            type="text" 
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.honorific || ''}
            onChange={(e) => onChange({...data, honorific: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Users size={10} /> Giới tính
          </label>
          <select 
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.gender || 'Nam'}
            onChange={(e) => onChange({...data, gender: e.target.value})}
          >
            <option>Nam</option>
            <option>Nữ</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Calendar size={10} /> Ngày sinh
          </label>
          <input 
            type="text" 
            placeholder="01/01/1900"
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.birthDate || ''}
            onChange={(e) => onChange({...data, birthDate: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Calendar size={10} /> Ngày mất
          </label>
          <input 
            type="text" 
            placeholder="15/03/1945"
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.deathDate || ''}
            onChange={(e) => onChange({...data, deathDate: e.target.value})}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Heart size={10} /> Tuổi thọ
          </label>
          <select 
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.lifespan || 0}
            onChange={(e) => onChange({...data, lifespan: parseInt(e.target.value)})}
          >
            {Array.from({ length: 121 }, (_, i) => i).map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
            <Edit2 size={10} /> Số thứ tự
          </label>
          <input 
            type="number" 
            className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
            value={data.order || ''}
            onChange={(e) => onChange({...data, order: parseInt(e.target.value) || 1})}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
          <MapPin size={10} /> Nơi sinh
        </label>
        <input 
          type="text" 
          className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
          value={data.birthPlace || ''}
          onChange={(e) => onChange({...data, birthPlace: e.target.value})}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
          <MapPin size={10} /> An táng
        </label>
        <input 
          type="text" 
          className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
          value={data.burialPlace || ''}
          onChange={(e) => onChange({...data, burialPlace: e.target.value})}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
          <Edit2 size={10} /> Tiểu sử
        </label>
        <textarea 
          className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none min-h-[100px] text-sm"
          value={data.biography || ''}
          onChange={(e) => onChange({...data, biography: e.target.value})}
        />
      </div>
    </div>
  );
};

// Moved outside to prevent re-creation on every render
const MemberCard = React.memo(({ 
  member, 
  i, 
  expandedId, 
  setExpandedId, 
  members, 
  navigateToMember, 
  showToast 
}: { 
  member: any, 
  i: number, 
  expandedId: string | null, 
  setExpandedId: (id: string | null) => void,
  members: any[],
  navigateToMember: (member: any) => void,
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
}) => {
  const isExpanded = expandedId === member.id;
  const memberChildren = members.filter(m => m.parentId === member.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Group children by mother
  const childrenByMother = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    memberChildren.forEach(child => {
      const mother = child.motherName || 'Chưa rõ mẹ';
      if (!grouped[mother]) grouped[mother] = [];
      grouped[mother].push(child);
    });
    return grouped;
  }, [memberChildren]);

  const spouses = useMemo(() => {
    if (member.spouses && member.spouses.length > 0) return member.spouses;
    if (member.spouse) return [{ name: member.spouse, type: 'Vợ' }];
    return [];
  }, [member]);

  return (
    <motion.div 
      id={`member-${member.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="glass-card rounded-3xl overflow-hidden border border-modern-100 shadow-sm mb-4"
    >
      <div 
        onClick={() => navigateToMember(member)}
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-white/50 transition-all"
      >
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center text-white overflow-hidden shadow-inner border-2",
          member.gender === 'Nữ' ? "border-pink-200 bg-pink-50" : "border-blue-200 bg-blue-50"
        )}>
          {member.photoURL ? (
            <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <img 
              src={member.gender === 'Nữ' 
                ? "https://api.dicebear.com/7.x/avataaars/svg?seed=Anya&top=longHair&hairColor=f1f1f1&backgroundColor=f472b6" 
                : "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortHair&hairColor=f1f1f1&facialHair=beardLight&facialHairColor=f1f1f1&backgroundColor=60a5fa"
              } 
              alt={member.gender} 
              className="w-full h-full object-cover opacity-90"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-modern-900 text-white px-2 py-0.5 rounded-lg font-bold">{member.order || 0}</span>
              <h4 className="font-bold text-modern-900 text-base sm:text-lg truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">{member.name}</h4>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-modern-500 font-bold uppercase tracking-wider">Đời {member.generation}</span>
              {(member.birthYear || member.birthDate) && (
                <span className="text-[10px] text-modern-400 font-medium">• {member.birthYear || member.birthDate.split('/').pop()}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(isExpanded ? null : member.id);
            }}
            className={cn(
              "p-2 rounded-xl transition-all",
              isExpanded ? "bg-modern-900 text-white" : "bg-modern-100 text-modern-500"
            )}
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-6 border-t border-modern-50 bg-modern-50/30"
          >
            {/* Hierarchy Tree */}
            <div className="pt-6 space-y-6 relative">
              {/* Vertical Line for Tree */}
              <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-modern-200 rounded-full" />

              {spouses.length > 0 ? (
                spouses.map((spouse: any, sIdx: number) => (
                  <div key={sIdx} className="relative pl-8">
                    {/* Horizontal Line to Spouse */}
                    <div className="absolute left-[11px] top-4 w-4 h-0.5 bg-modern-200" />
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-pink-100 text-pink-600 rounded-xl shadow-sm">
                        <Heart size={16} fill="currentColor" />
                      </div>
                      <div className="flex-1">
                        <button 
                          onClick={() => {
                            const spouseMember = members.find(m => m.name.toLowerCase() === spouse.name.toLowerCase());
                            if (spouseMember) {
                              navigateToMember(spouseMember);
                            } else {
                              showToast(`Không tìm thấy thông tin chi tiết cho ${spouse.name}`, 'info');
                            }
                          }}
                          className="flex items-center gap-2 hover:opacity-70 transition-opacity text-left"
                        >
                          <p className="text-sm font-bold text-modern-900">{spouse.name}</p>
                          <span className="text-[10px] bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full font-bold uppercase">Vợ {sIdx + 1}</span>
                        </button>
                        
                        {/* Children under this spouse */}
                        <div className="mt-4 space-y-3 relative">
                          {/* Vertical Line for Children */}
                          {childrenByMother[spouse.name] && childrenByMother[spouse.name].length > 0 && (
                            <div className="absolute left-[-17px] top-0 bottom-4 w-0.5 bg-modern-100 rounded-full" />
                          )}
                          
                          {childrenByMother[spouse.name]?.map((child, cIdx) => (
                            <div key={child.id} className="relative pl-4">
                              {/* Horizontal Line to Child */}
                              <div className="absolute left-[-17px] top-4 w-4 h-0.5 bg-modern-100" />
                              
                              <button 
                                onClick={() => navigateToMember(child)}
                                className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-modern-100 shadow-sm hover:border-modern-300 hover:shadow-md transition-all text-left group"
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center text-white overflow-hidden shadow-inner",
                                  child.gender === 'Nữ' ? "bg-pink-100" : "bg-blue-100"
                                )}>
                                  {child.photoURL ? (
                                    <img src={child.photoURL} alt={child.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <img 
                                      src={child.gender === 'Nữ' 
                                        ? "https://api.dicebear.com/7.x/avataaars/svg?seed=Anya&top=longHair&hairColor=f1f1f1&backgroundColor=f472b6" 
                                        : "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortHair&hairColor=f1f1f1&facialHair=beardLight&facialHairColor=f1f1f1&backgroundColor=60a5fa"
                                      } 
                                      alt={child.gender} 
                                      className="w-full h-full object-cover opacity-80"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-modern-900 group-hover:text-modern-600 transition-colors">
                                    {child.order || cIdx + 1}. {child.name}
                                  </p>
                                  <p className="text-[9px] text-modern-400 font-medium">Con của {member.name} & {spouse.name}</p>
                                </div>
                                <ChevronRight size={14} className="text-modern-300 group-hover:text-modern-500 transition-all" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="relative pl-8">
                  <div className="absolute left-[11px] top-4 w-4 h-0.5 bg-modern-200" />
                  <p className="text-xs text-modern-400 italic">Chưa có thông tin vợ/chồng.</p>
                </div>
              )}

              {/* Children with no mother specified */}
              {childrenByMother['Chưa rõ mẹ']?.length > 0 && (
                <div className="relative pl-8">
                  <div className="absolute left-[11px] top-4 w-4 h-0.5 bg-modern-200" />
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-modern-100 text-modern-500 rounded-xl">
                      <Users size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-modern-900">Các con khác</p>
                      <div className="mt-4 space-y-3">
                        {childrenByMother['Chưa rõ mẹ'].map((child, cIdx) => (
                          <button 
                            key={child.id} 
                            onClick={() => navigateToMember(child)}
                            className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-modern-100 shadow-sm hover:border-modern-300 transition-all text-left"
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center text-white overflow-hidden",
                              child.gender === 'Nữ' ? "bg-pink-100" : "bg-blue-100"
                            )}>
                              <User size={14} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-modern-900">{child.name}</p>
                              <p className="text-[9px] text-modern-400">Con của {member.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => navigateToMember(member)}
              className="w-full mt-6 py-4 bg-modern-900 hover:bg-black rounded-2xl text-xs font-bold text-white uppercase tracking-widest transition-all shadow-lg shadow-modern-900/20"
            >
              Xem chi tiết đầy đủ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export const FamilyTreeScreen = () => {
  const { 
    members, 
    showToast, 
    hiddenGenerations, 
    hiddenMemberIds,
    isAdmin,
    user,
    selectedMemberId,
    setSelectedMemberId,
    selectedSpouseIndex,
    setSelectedSpouseIndex,
    refreshData,
    addMembers
  } = useFirebase();

  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedSpouse, setSelectedSpouse] = useState<any>(null);

  // Lazy load children when a member is selected
  React.useEffect(() => {
    if (selectedMember) {
      const loadChildren = async () => {
        try {
          const q = query(
            collection(db, 'members'),
            where('familyTreeId', '==', FAMILY_TREE_ID),
            where('parentId', '==', selectedMember.id)
          );
          
          let snap;
          try {
            snap = await getDocs(q);
          } catch (error: any) {
            if (error.message?.includes('Quota exceeded') || error.code === 'unavailable') {
              snap = await getDocsFromCache(q);
            } else {
              throw error;
            }
          }

          if (snap && !snap.empty) {
            addMembers(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
          }
        } catch (error) {
          console.error("Error lazy loading children:", error);
        }
      };
      loadChildren();
    }
  }, [selectedMember?.id]);
  const [history, setHistory] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastViewedMemberId, setLastViewedMemberId] = useState<string | null>(null);

  const navigateToMember = (member: any) => {
    setLastViewedMemberId(member.id);
    if (selectedMember) {
      setHistory(prev => [...prev, selectedMember]);
    }
    setSelectedMember(member);
    setSelectedMemberId(member.id);
    setSelectedSpouse(null);
  };

  // Sync with context selectedMemberId
  React.useEffect(() => {
    if (selectedMemberId) {
      const member = members.find(m => m.id === selectedMemberId);
      if (member && (!selectedMember || selectedMember.id !== selectedMemberId)) {
        // If it's a new selection from outside, we might want to clear history or handle it
        // For now, just set it
        setSelectedMember(member);
        setSelectedSpouse(null);
      }
      
      // Handle spouse selection if index is provided
      if (member && selectedSpouseIndex !== null && selectedSpouseIndex !== undefined) {
        if (member.extraSpouses && member.extraSpouses[selectedSpouseIndex]) {
          setSelectedSpouse(member.extraSpouses[selectedSpouseIndex]);
          // We don't clear the index yet, maybe later when closing modal
        }
      }
    } else if (selectedMember) {
      setSelectedMember(null);
      setHistory([]);
    }
  }, [selectedMemberId, selectedSpouseIndex, members]);

  // Scroll to top when a member is selected
  React.useEffect(() => {
    if (selectedMember) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedMember]);

  const goBack = () => {
    setSelectedSpouse(null);
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setSelectedMember(prev);
      setSelectedMemberId(prev.id);
    } else {
      setSelectedMember(null);
      setSelectedMemberId(null);
      setHistory([]);
    }
  };

  const spouseMember = useMemo(() => 
    selectedMember?.spouse ? members.find(m => m.name.toLowerCase() === selectedMember.spouse.toLowerCase()) : null,
    [members, selectedMember]
  );
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Scroll back to last viewed member when returning to list
  React.useEffect(() => {
    if (!selectedMember && !isAdding && !isEditing && lastViewedMemberId) {
      // Use a small timeout to ensure the list has rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(`member-${lastViewedMemberId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the member briefly
          element.classList.add('ring-2', 'ring-modern-400', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-modern-400', 'ring-offset-4');
          }, 2000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedMember, isAdding, isEditing, lastViewedMemberId]);
  const [showSpouseSection, setShowSpouseSection] = useState(false);
  const [showChildSection, setShowChildSection] = useState(false);

  const emptyMember = {
    name: '', 
    generation: 1, 
    spouse: '', 
    spouses: [] as any[],
    honorific: '',
    birthYear: '', 
    deathYear: '',
    birthDate: '',
    deathDate: '',
    lifespan: 0,
    birthPlace: '',
    familyDetails: '',
    biography: '', 
    burialInfo: '', 
    burialPlace: '',
    gender: 'Nam',
    parentId: '',
    fatherName: '',
    motherName: '',
    photoURL: '',
    order: 1,
    spouse1: '',
    spouse2: '',
    child1: '',
    child2: '',
    child3: '',
    extraSpouses: [] as any[],
    extraChildren: [] as any[]
  };

  const [newMember, setNewMember] = useState(emptyMember);

  const filteredMembers = useMemo(() => {
    const memberMap = new Map(members.map(m => [m.id, m]));
    
    const getPath = (member: any): { order: number, time: number }[] => {
      const path: { order: number, time: number }[] = [];
      let current = member;
      while (current) {
        path.unshift({ 
          order: current.order || 0, 
          time: current.createdAt ? new Date(current.createdAt).getTime() : 0 
        });
        if (current.parentId && memberMap.has(current.parentId)) {
          current = memberMap.get(current.parentId);
        } else {
          break;
        }
      }
      return path;
    };

    const comparePaths = (p1: { order: number, time: number }[], p2: { order: number, time: number }[]) => {
      const len = Math.min(p1.length, p2.length);
      for (let i = 0; i < len; i++) {
        if (p1[i].order !== p2[i].order) return p1[i].order - p2[i].order;
        if (p1[i].time !== p2[i].time) return p1[i].time - p2[i].time;
      }
      return p1.length - p2.length;
    };

    return members
      .filter(m => {
        const s = search.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(s);
        const matchesSpouse = m.spouse?.toLowerCase().includes(s);
        const matchesExtraSpouses = m.extraSpouses?.some((sp: any) => sp.name?.toLowerCase().includes(s));
        const matchesSearch = matchesName || matchesSpouse || matchesExtraSpouses;

        if (search) return matchesSearch;
        
        return (
          matchesSearch &&
          !hiddenGenerations.includes(Number(m.generation)) &&
          !hiddenMemberIds.includes(m.id)
        );
      })
      .sort((a, b) => {
        // Primary sort by generation to keep the UI grouping consistent
        if (Number(a.generation) !== Number(b.generation)) {
          return Number(a.generation) - Number(b.generation);
        }
        // Within same generation, sort by full lineage path
        return comparePaths(getPath(a), getPath(b));
      });
  }, [members, search, hiddenGenerations, hiddenMemberIds]);

  const children = useMemo(() => {
    if (!selectedMember) return [];
    return members
      .filter(m => m.parentId === selectedMember.id)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return (a.order || 0) - (b.order || 0);
        }
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
  }, [members, selectedMember]);

  const generations = useMemo(() => {
    return Array.from(new Set(filteredMembers.map(m => Number(m.generation)))).sort((a: number, b: number) => a - b);
  }, [filteredMembers]);

  const potentialFathers = useMemo(() => {
    const prevGen = (parseInt(newMember.generation as any) || 1) - 1;
    if (prevGen < 1) return [];
    return members.filter(m => Number(m.generation) === prevGen && m.gender === 'Nam');
  }, [newMember.generation, members]);

  const potentialMothers = useMemo(() => {
    const prevGen = (parseInt(newMember.generation as any) || 1) - 1;
    if (prevGen < 1) return [];
    return members.filter(m => Number(m.generation) === prevGen && m.gender === 'Nữ');
  }, [newMember.generation, members]);

  const existingChildren = useMemo(() => {
    if (!isEditing || !newMember.id) return [];
    return members.filter(m => m.parentId === newMember.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [isEditing, newMember.id, members]);

  const handleAddMember = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    try {
      const memberData = {
        ...newMember,
        familyTreeId: FAMILY_TREE_ID,
        birthYear: parseInt(newMember.birthYear as string) || 0,
        deathYear: parseInt(newMember.deathYear as string) || 0,
        generation: parseInt(newMember.generation as string) || 1,
        order: parseInt(newMember.order as string) || 1,
        updatedAt: new Date().toISOString()
      };

      let mainMemberId = '';
      if (isEditing && selectedMember) {
        mainMemberId = selectedMember.id;
        await updateDoc(doc(db, 'members', mainMemberId), memberData);
        setIsEditing(false);
        setSelectedMember({ ...selectedMember, ...memberData });
      } else {
        const docRef = await addDoc(collection(db, 'members'), {
          ...memberData,
          createdAt: new Date().toISOString()
        });
        mainMemberId = docRef.id;
      }

      // Handle extra children added in the form
      if (newMember.extraChildren && newMember.extraChildren.length > 0) {
        for (const child of newMember.extraChildren) {
          if (child.name) {
            await addDoc(collection(db, 'members'), {
              ...child,
              familyTreeId: FAMILY_TREE_ID,
              parentId: mainMemberId,
              generation: (memberData.generation || 0) + 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      setIsAdding(false);
      await refreshData(true);
      setLastViewedMemberId(mainMemberId);
      setNewMember(emptyMember);
      setShowSpouseSection(false);
      setShowChildSection(false);
      showToast('Đã lưu thông tin thành công!', 'success');
      if (!isEditing) setSelectedMember(null); 
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'members', showToast);
    }
  };

  const handleEditClick = () => {
    setNewMember({
      ...emptyMember,
      ...selectedMember,
      birthYear: selectedMember.birthYear?.toString() || '',
      deathYear: selectedMember.deathYear?.toString() || '',
      extraSpouses: selectedMember.extraSpouses || [],
      extraChildren: [] // We don't edit existing children here, they are separate members
    });
    setIsEditing(true);
    setIsAdding(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 700 * 1024) {
        showToast('Ảnh quá lớn! Vui lòng chọn ảnh dưới 700KB.', 'error');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setNewMember({ ...newMember, photoURL: base64 });
      } catch (error) {
        console.error("Error uploading photo:", error);
      }
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    try {
      await deleteDoc(doc(db, 'members', id));
      await refreshData(true);
      setSelectedMember(null);
      showToast('Đã xóa thành viên thành công!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`, showToast);
    }
  };

  if (isAdding) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 p-6 pb-24"
      >
        <header className="mt-8 flex items-center gap-4">
          <button onClick={() => { setIsAdding(false); setIsEditing(false); }} className="p-2 bg-modern-200 rounded-xl text-modern-700">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-bold text-modern-900">{isEditing ? 'Sửa thành viên' : 'Thêm thành viên'}</h1>
        </header>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative group">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white overflow-hidden bg-modern-100",
                !newMember.photoURL && (newMember.gender === 'Nữ' ? "bg-pink-100" : "bg-blue-100")
              )}>
                {newMember.photoURL ? (
                  <img src={newMember.photoURL} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className="text-modern-300" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-modern-900 text-white rounded-full cursor-pointer shadow-lg active:scale-90 transition-transform">
                <Upload size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
            <p className="text-[10px] text-modern-400 font-bold uppercase tracking-widest">Ảnh đại diện</p>
          </div>

          {/* 1. Họ và tên */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
              <User size={10} /> Họ và tên
            </label>
            <input 
              type="text" 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none font-medium"
              value={newMember.name}
              onChange={(e) => setNewMember({...newMember, name: e.target.value})}
            />
          </div>

          {/* 2. Danh hiệu / Tước hiệu */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
              <Edit2 size={10} /> Danh hiệu / Tước hiệu
            </label>
            <input 
              type="text" 
              placeholder="Ví dụ: Cụ tổ, Trưởng họ..."
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
              value={newMember.honorific}
              onChange={(e) => setNewMember({...newMember, honorific: e.target.value})}
            />
          </div>

          {/* 3. Đời thứ & 4. Giới tính */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Users size={10} /> Đời thứ
              </label>
              <select 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.generation}
                onChange={(e) => setNewMember({...newMember, generation: parseInt(e.target.value)})}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Users size={10} /> Giới tính
              </label>
              <select 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.gender}
                onChange={(e) => setNewMember({...newMember, gender: e.target.value})}
              >
                <option>Nam</option>
                <option>Nữ</option>
              </select>
            </div>
          </div>

          {/* 5. Ngày tháng năm sinh & 6. Ngày tháng năm mất */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Calendar size={10} /> Ngày tháng năm sinh
              </label>
              <input 
                type="text" 
                placeholder="Ví dụ: 01/01/1900"
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.birthDate}
                onChange={(e) => setNewMember({...newMember, birthDate: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Calendar size={10} /> Ngày tháng năm mất
              </label>
              <input 
                type="text" 
                placeholder="Ví dụ: 15/03/1945"
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.deathDate}
                onChange={(e) => setNewMember({...newMember, deathDate: e.target.value})}
              />
            </div>
          </div>

          {/* 7. Tuổi thọ & Số thứ tự */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Heart size={10} /> Tuổi thọ
              </label>
              <select 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.lifespan}
                onChange={(e) => setNewMember({...newMember, lifespan: parseInt(e.target.value)})}
              >
                {Array.from({ length: 121 }, (_, i) => i).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Edit2 size={10} /> Số thứ tự
              </label>
              <input 
                type="number" 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newMember.order}
                onChange={(e) => setNewMember({...newMember, order: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          {/* 8. Bố nào & 9. Mẹ nào */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <User size={10} /> Bố nào (Đời { (parseInt(newMember.generation as any) || 1) - 1 })
              </label>
              {potentialFathers.length > 0 ? (
                <select 
                  className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
                  value={newMember.fatherName}
                  onChange={(e) => {
                    const father = potentialFathers.find(f => f.name === e.target.value);
                    setNewMember({
                      ...newMember, 
                      fatherName: e.target.value,
                      parentId: father?.id || newMember.parentId
                    });
                  }}
                >
                  <option value="">-- Chọn bố --</option>
                  {potentialFathers.map((f, i) => (
                    <option key={i} value={f.name}>{f.name}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder="Nhập tên bố..."
                  className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
                  value={newMember.fatherName}
                  onChange={(e) => setNewMember({...newMember, fatherName: e.target.value})}
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
                <Heart size={10} /> Mẹ nào (Đời { (parseInt(newMember.generation as any) || 1) - 1 })
              </label>
              {potentialMothers.length > 0 ? (
                <select 
                  className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
                  value={newMember.motherName}
                  onChange={(e) => setNewMember({...newMember, motherName: e.target.value})}
                >
                  <option value="">-- Chọn mẹ --</option>
                  {potentialMothers.map((m, i) => (
                    <option key={i} value={m.name}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder="Nhập tên mẹ..."
                  className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none text-sm"
                  value={newMember.motherName}
                  onChange={(e) => setNewMember({...newMember, motherName: e.target.value})}
                />
              )}
            </div>
          </div>

          {/* 10. Nơi sinh */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
              <MapPin size={10} /> Nơi sinh
            </label>
            <input 
              type="text" 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
              value={newMember.birthPlace}
              onChange={(e) => setNewMember({...newMember, birthPlace: e.target.value})}
            />
          </div>

          {/* 9. An táng */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
              <MapPin size={10} /> An táng
            </label>
            <input 
              type="text" 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
              value={newMember.burialPlace}
              onChange={(e) => setNewMember({...newMember, burialPlace: e.target.value})}
            />
          </div>

          {/* 10. Tiểu sử */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1 flex items-center gap-1">
              <Edit2 size={10} /> Tiểu sử
            </label>
            <textarea 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none min-h-[120px]"
              value={newMember.biography}
              onChange={(e) => setNewMember({...newMember, biography: e.target.value})}
            />
          </div>

          {/* Relationship Sections (Spouses & Children) */}
          <div className="pt-4 border-t border-modern-100 space-y-6">
            <h3 className="text-xs font-bold text-modern-900 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-modern-500" /> Mối quan hệ gia đình
            </h3>

            {/* Dynamic Spouse Section */}
            <div className="space-y-2">
              <button 
                onClick={() => setShowSpouseSection(!showSpouseSection)}
                className="w-full flex items-center justify-between p-4 bg-pink-50 text-pink-600 rounded-2xl font-bold text-sm hover:bg-pink-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Heart size={18} />
                  <span>Thông tin Vợ/Chồng ({newMember.extraSpouses?.length || 0})</span>
                </div>
                {showSpouseSection ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              
              <AnimatePresence>
                {showSpouseSection && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-2"
                  >
                    {newMember.extraSpouses?.map((spouse, idx) => (
                      <div key={idx} className="relative">
                        <button 
                          onClick={() => {
                            const updated = [...newMember.extraSpouses];
                            updated.splice(idx, 1);
                            setNewMember({...newMember, extraSpouses: updated});
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full z-10 shadow-md"
                        >
                          <X size={12} />
                        </button>
                        <MemberFormFields 
                          title={`Vợ/Chồng ${idx + 1}`}
                          data={spouse} 
                          members={members}
                          onChange={(val) => {
                            const updated = [...newMember.extraSpouses];
                            updated[idx] = val;
                            setNewMember({...newMember, extraSpouses: updated});
                          }} 
                        />
                      </div>
                    ))}
                    <button 
                      onClick={() => setNewMember({
                        ...newMember, 
                        extraSpouses: [...(newMember.extraSpouses || []), { ...emptyMember, gender: newMember.gender === 'Nam' ? 'Nữ' : 'Nam' }]
                      })}
                      className="w-full py-3 border-2 border-dashed border-pink-200 text-pink-400 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-pink-50 transition-colors"
                    >
                      <Plus size={16} /> Thêm Vợ/Chồng
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dynamic Child Section */}
            <div className="space-y-2">
              <button 
                onClick={() => setShowChildSection(!showChildSection)}
                className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-sm hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users size={18} />
                  <span>Thông tin Con cái ({existingChildren.length + (newMember.extraChildren?.length || 0)})</span>
                </div>
                {showChildSection ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              
              <AnimatePresence>
                {showChildSection && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-2"
                  >
                    {/* Existing Children List */}
                    {existingChildren.length > 0 && (
                      <div className="space-y-2 px-2">
                        <p className="text-[10px] font-bold text-modern-400 uppercase tracking-widest">Danh sách con đã nhập ({existingChildren.length})</p>
                        <div className="grid grid-cols-1 gap-2">
                          {existingChildren.map((child) => (
                            <div 
                              key={child.id}
                              className="flex items-center justify-between p-3 bg-white border border-modern-100 rounded-xl shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-white",
                                  child.gender === 'Nữ' ? "bg-pink-100 text-pink-500" : "bg-blue-100 text-blue-500"
                                )}>
                                  <User size={14} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-modern-900">{child.name}</p>
                                  <p className="text-[10px] text-modern-400">Đời thứ {child.generation}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (window.confirm(`Bạn có muốn chuyển sang chỉnh sửa thông tin của ${child.name}? Các thay đổi chưa lưu của thành viên hiện tại sẽ bị mất.`)) {
                                    setSelectedMember(child);
                                    setNewMember({
                                      ...emptyMember,
                                      ...child,
                                      birthYear: child.birthYear?.toString() || '',
                                      deathYear: child.deathYear?.toString() || '',
                                      extraSpouses: child.extraSpouses || [],
                                      extraChildren: []
                                    });
                                    setIsEditing(true);
                                    setIsAdding(true);
                                    setShowChildSection(false);
                                  }
                                }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Chỉnh sửa con này"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Children Being Added */}
                    {newMember.extraChildren?.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <p className="text-[10px] font-bold text-modern-400 uppercase tracking-widest px-2">Con mới đang thêm ({newMember.extraChildren.length})</p>
                        {newMember.extraChildren.map((child, idx) => (
                          <div key={idx} className="relative">
                            <button 
                              onClick={() => {
                                const updated = [...newMember.extraChildren];
                                updated.splice(idx, 1);
                                setNewMember({...newMember, extraChildren: updated});
                              }}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full z-10 shadow-md"
                            >
                              <X size={12} />
                            </button>
                            <MemberFormFields 
                              title={`Con mới thứ ${idx + 1}`}
                              data={child} 
                              members={members}
                              spouses={newMember.extraSpouses}
                              onChange={(val) => {
                                const updated = [...newMember.extraChildren];
                                updated[idx] = val;
                                setNewMember({...newMember, extraChildren: updated});
                              }} 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setNewMember({
                        ...newMember, 
                        extraChildren: [...(newMember.extraChildren || []), { ...emptyMember, generation: (parseInt(newMember.generation as any) || 0) + 1 }]
                      })}
                      className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-400 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={16} /> Thêm Con mới
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button 
            onClick={handleAddMember}
            className="w-full blue-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-modern-500/20 active:scale-95 transition-transform mt-4"
          >
            <Save size={18} /> Lưu thông tin
          </button>
        </div>
      </motion.div>
    );
  }

  if (selectedMember) {
    const children = members
      .filter(m => m.parentId === selectedMember.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col min-h-screen bg-modern-50/30"
      >
        {/* Sticky Header Bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-modern-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="p-2 bg-modern-100 rounded-xl text-modern-700 hover:bg-modern-200 transition-colors">
              {history.length > 0 ? <ArrowLeft size={20} /> : <X size={20} />}
            </button>
            <div>
              <p className="text-[10px] text-modern-400 font-bold uppercase tracking-widest">Thông tin gia phả</p>
              <h1 className="text-sm font-bold text-modern-900 truncate max-w-[150px]">{selectedMember.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button onClick={handleEditClick} className="p-2 bg-modern-100 text-modern-600 rounded-xl hover:bg-modern-200 transition-colors">
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn xóa thành viên này?')) {
                      handleDeleteMember(selectedMember.id);
                    }
                  }} 
                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative pt-4 pb-4 px-6 bg-gradient-to-b from-white to-transparent">
          <div className="flex flex-col items-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              onClick={goBack}
              className={cn(
                "w-28 h-28 rounded-[28px] flex items-center justify-center text-white shadow-lg border-4 border-white overflow-hidden bg-modern-100 transform rotate-1 hover:rotate-0 transition-transform duration-500 cursor-pointer group relative mb-3",
                !selectedMember.photoURL && (selectedMember.gender === 'Nữ' ? "bg-pink-100" : "bg-blue-100")
              )}
            >
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <ArrowLeft size={28} className="text-white drop-shadow-lg" />
              </div>
              {selectedMember.photoURL ? (
                <img src={selectedMember.photoURL} alt={selectedMember.name} className="w-full h-full object-cover" />
              ) : (
                <img 
                  src={selectedMember.gender === 'Nữ' 
                    ? "https://api.dicebear.com/7.x/avataaars/svg?seed=Anya&top=longHair&hairColor=f1f1f1&backgroundColor=f472b6" 
                    : "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortHair&hairColor=f1f1f1&facialHair=beardLight&facialHairColor=f1f1f1&backgroundColor=60a5fa"
                  } 
                  alt={selectedMember.gender} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>

            <div className="text-center w-full max-w-sm mx-auto">
              {selectedMember.honorific && (
                <motion.p 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-modern-500 font-serif italic text-xs mb-0.5"
                >
                  {selectedMember.honorific}
                </motion.p>
              )}
              <motion.h2 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={goBack}
                className="text-xl sm:text-2xl font-black text-modern-900 leading-tight cursor-pointer hover:text-modern-600 transition-colors mb-2 truncate w-full px-2"
                style={{ fontSize: 'clamp(1.25rem, 5vw, 1.875rem)' }}
              >
                {selectedMember.name}
              </motion.h2>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-1.5"
              >
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-sm",
                  selectedMember.gender === 'Nam' ? "bg-blue-600 text-white" : "bg-pink-600 text-white"
                )}>
                  {selectedMember.gender}
                </span>
                <span className="px-2 py-0.5 bg-white text-modern-600 border border-modern-100 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-sm">
                  Đời {selectedMember.generation}
                </span>
                <span className="px-2 py-0.5 bg-modern-900 text-white rounded-full text-[8px] font-bold uppercase tracking-widest shadow-sm">
                  {selectedMember.order || 0}
                </span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Bento Grid Info Section */}
        <div className="px-4 pb-24 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Birth/Death Card */}
            <div className="glass-card rounded-xl p-3 border border-modern-100 shadow-sm bg-white/50 flex flex-col justify-between min-h-[60px]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="p-1 bg-blue-50 text-blue-500 rounded-md">
                  <Calendar size={10} />
                </div>
                <p className="text-[8px] text-modern-400 uppercase font-bold tracking-wider">Sinh / Tử</p>
              </div>
              <p className="font-bold text-modern-900 text-[11px] leading-tight">
                {selectedMember.birthDate || selectedMember.birthYear || '?'}{' - '}{selectedMember.deathDate || selectedMember.deathYear || '?'}
              </p>
            </div>

            {/* Lifespan Card */}
            <div className="glass-card rounded-xl p-3 border border-modern-100 shadow-sm bg-white/50 flex flex-col justify-between min-h-[60px]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="p-1 bg-pink-50 text-pink-500 rounded-md">
                  <Heart size={10} />
                </div>
                <p className="text-[8px] text-modern-400 uppercase font-bold tracking-wider">Tuổi thọ</p>
              </div>
              <p className="font-bold text-modern-900 text-[11px] leading-tight">
                {selectedMember.lifespan || 'N/A'}
                <span className="text-[9px] font-normal text-modern-500 ml-0.5">tuổi</span>
              </p>
            </div>

            {/* Birth Place */}
            {selectedMember.birthPlace && (
              <div className={cn(
                "glass-card rounded-xl p-3 border border-modern-100 shadow-sm bg-white/50 min-h-[60px]",
                !selectedMember.burialPlace ? "col-span-2" : "col-span-1"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="p-1 bg-modern-50 text-modern-500 rounded-md">
                    <MapPin size={10} />
                  </div>
                  <p className="text-[8px] text-modern-400 uppercase font-bold tracking-wider">Nơi sinh</p>
                </div>
                <p className="text-modern-900 font-medium text-[10px] leading-tight line-clamp-2">{selectedMember.birthPlace}</p>
              </div>
            )}

            {/* Burial Place */}
            {selectedMember.burialPlace && (
              <div className={cn(
                "glass-card rounded-xl p-3 border border-modern-100 shadow-sm bg-white/50 min-h-[60px]",
                !selectedMember.birthPlace ? "col-span-2" : "col-span-1"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="p-1 bg-modern-900 text-white rounded-md">
                    <MapPin size={10} />
                  </div>
                  <p className="text-[8px] text-modern-400 uppercase font-bold tracking-wider">An táng</p>
                </div>
                <p className="text-modern-900 font-medium text-[10px] leading-tight line-clamp-2">{selectedMember.burialPlace}</p>
              </div>
            )}
          </div>

          {/* Family Relations Section */}
          <div className="glass-card rounded-xl p-4 border border-modern-100 shadow-sm space-y-3 bg-white/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-modern-900 text-white rounded-md">
                <Users size={12} />
              </div>
              <p className="text-[9px] text-modern-900 uppercase font-bold tracking-widest">Gia đình</p>
            </div>
            
            {/* Parents Row */}
            {(selectedMember.parentId || selectedMember.fatherName || selectedMember.motherName) && (
              <div className="space-y-1.5">
                <p className="text-[8px] text-modern-400 font-bold uppercase tracking-wider">Cha & Mẹ</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMember.parentId || selectedMember.fatherName) && (
                    <button 
                      onClick={() => {
                        const father = members.find(m => m.id === selectedMember.parentId || (m.name === selectedMember.fatherName && m.gender === 'Nam'));
                        if (father) navigateToMember(father);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-colors"
                    >
                      <User size={8} /> Cha: {selectedMember.fatherName || members.find(m => m.id === selectedMember.parentId)?.name || 'Chưa rõ'}
                    </button>
                  )}
                  {selectedMember.motherName && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-50/50 border border-pink-100 rounded-lg text-pink-700 text-[10px] font-bold">
                      <Heart size={8} /> Mẹ: {selectedMember.motherName}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Spouses Row */}
            <div className="space-y-1.5">
              <p className="text-[8px] text-modern-400 font-bold uppercase tracking-wider">Vợ / Chồng</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedMember.spouse1 && (
                  <button 
                    onClick={() => {
                      const realSpouse = members.find(m => m.name.toLowerCase() === selectedMember.spouse1.toLowerCase());
                      if (realSpouse) navigateToMember(realSpouse);
                      else setSelectedSpouse({ name: selectedMember.spouse1, type: 'Vợ 1' });
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-50/30 border border-pink-100 rounded-lg text-pink-600 text-[10px] font-bold hover:bg-pink-100 transition-all"
                  >
                    <Heart size={8} fill="currentColor" /> {selectedMember.spouse1}
                  </button>
                )}
                {selectedMember.spouse2 && (
                  <button 
                    onClick={() => {
                      const realSpouse = members.find(m => m.name.toLowerCase() === selectedMember.spouse2.toLowerCase());
                      if (realSpouse) navigateToMember(realSpouse);
                      else setSelectedSpouse({ name: selectedMember.spouse2, type: 'Vợ 2' });
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-50/30 border border-pink-100 rounded-lg text-pink-600 text-[10px] font-bold hover:bg-pink-100 transition-all"
                  >
                    <Heart size={8} fill="currentColor" /> {selectedMember.spouse2}
                  </button>
                )}
                {selectedMember.extraSpouses?.map((s: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      const realSpouse = members.find(m => m.name.toLowerCase() === s.name.toLowerCase());
                      if (realSpouse) navigateToMember(realSpouse);
                      else setSelectedSpouse({ ...s, type: `Vợ/Chồng ${idx + 1}` });
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-50/30 border border-pink-100 rounded-lg text-pink-600 text-[10px] font-bold hover:bg-pink-100 transition-all"
                  >
                    <Heart size={8} fill="currentColor" /> {s.name}
                  </button>
                ))}
                {(!selectedMember.spouses || selectedMember.spouses.length === 0) && !selectedMember.spouse1 && !selectedMember.spouse2 && (!selectedMember.extraSpouses || selectedMember.extraSpouses.length === 0) && (
                  <p className="text-[10px] font-bold text-modern-900 px-2.5 py-1 bg-modern-50 rounded-lg border border-modern-100">
                    {selectedMember.spouse || 'Chưa cập nhật'}
                  </p>
                )}
              </div>
            </div>

            {/* Children Section */}
            <div className="space-y-1.5">
              <p className="text-[8px] text-modern-400 font-bold uppercase tracking-wider">Con cái ({children.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {children.map((child, cIdx) => (
                  <button 
                    key={child.id}
                    onClick={() => navigateToMember(child)}
                    className="flex items-center gap-1.5 p-1.5 bg-white/60 border border-modern-100 rounded-lg hover:border-modern-300 transition-all group"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-md flex items-center justify-center text-white text-[7px] font-bold shrink-0",
                      child.gender === 'Nữ' ? "bg-pink-300" : "bg-blue-300"
                    )}>
                      {child.order || cIdx + 1}
                    </div>
                    <p className="text-[9px] font-bold text-modern-900 truncate group-hover:text-modern-600">{child.name}</p>
                  </button>
                ))}
                {children.length === 0 && (
                  <p className="text-[9px] text-modern-400 italic">Chưa có thông tin con cái.</p>
                )}
              </div>
            </div>
          </div>

          {/* Siblings & Biography */}
          <div className="space-y-3">
            {/* Siblings */}
            {selectedMember.parentId && (
              <div className="glass-card rounded-xl p-4 border border-modern-100 shadow-sm bg-white/30">
                <p className="text-[8px] text-modern-400 uppercase font-bold mb-2 tracking-widest">Anh chị em</p>
                <div className="flex flex-wrap gap-1">
                  {members
                    .filter(m => m.parentId === selectedMember.parentId && m.id !== selectedMember.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map(sibling => (
                      <button 
                        key={sibling.id}
                        onClick={() => navigateToMember(sibling)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold transition-all border",
                          sibling.gender === 'Nữ' 
                            ? "bg-pink-50/30 border-pink-100 text-pink-600" 
                            : "bg-blue-50/30 border-blue-100 text-blue-600"
                        )}
                      >
                        {sibling.order}. {sibling.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Biography */}
            <div className="glass-card rounded-xl p-4 border border-modern-100 shadow-sm bg-white/40 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-modern-100 text-modern-600 rounded-md">
                  <BookOpen size={12} />
                </div>
                <p className="text-[9px] text-modern-400 uppercase font-bold tracking-widest">Tiểu sử</p>
              </div>
              <p className="text-[10px] text-modern-700 leading-relaxed whitespace-pre-wrap">
                {selectedMember.biography || 'Không có thông tin tiểu sử.'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button 
              onClick={() => {
                setNewMember({
                  ...emptyMember,
                  generation: (selectedMember.generation || 0) + 1,
                  parentId: selectedMember.id,
                  order: children.length + 1
                });
                setIsAdding(true);
                setIsEditing(false);
              }}
              className="w-full py-2.5 border-2 border-dashed border-modern-200 text-modern-400 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold hover:bg-modern-50 transition-colors"
            >
              <Plus size={14} /> Thêm con mới
            </button>
          )}
        </div>

        {/* Spouse Detail Modal */}
        <AnimatePresence>
          {selectedSpouse && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSelectedSpouse(null);
                  setSelectedSpouseIndex(null);
                }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl"
              >
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-500">
                        <Heart size={24} />
                      </div>
                      <div>
                        <button 
                          onClick={() => {
                            setSelectedSpouse(null);
                            setSelectedSpouseIndex(null);
                          }}
                          className="text-xl font-bold text-modern-900 hover:text-pink-600 transition-colors text-left flex items-center gap-2 group"
                        >
                          <ArrowLeft size={18} className="text-modern-300 group-hover:text-pink-400 transition-colors" />
                          {selectedSpouse.name}
                        </button>
                        <div className="flex items-center gap-2 ml-6">
                          {selectedSpouse.honorific && (
                            <span className="text-[10px] bg-modern-100 text-modern-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                              {selectedSpouse.honorific}
                            </span>
                          )}
                          <p className="text-xs font-bold text-modern-400 uppercase tracking-wider">{selectedSpouse.type || 'Vợ'}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedSpouse(null);
                        setSelectedSpouseIndex(null);
                      }}
                      className="p-2 hover:bg-modern-100 rounded-full transition-colors"
                    >
                      <X size={20} className="text-modern-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-modern-50 rounded-2xl border border-modern-100">
                      <p className="text-[10px] text-modern-400 uppercase font-bold mb-1">Sinh / Tử</p>
                      <p className="text-sm font-bold text-modern-900">
                        {selectedSpouse.birthDate || selectedSpouse.birthYear || '?'}{' - '}{selectedSpouse.deathDate || selectedSpouse.deathYear || '?'}
                      </p>
                    </div>
                    <div className="p-4 bg-modern-50 rounded-2xl border border-modern-100">
                      <p className="text-[10px] text-modern-400 uppercase font-bold mb-1">Tuổi thọ</p>
                      <p className="text-sm font-bold text-modern-900">
                        {selectedSpouse.lifespan || 'N/A'}
                        <span className="text-[10px] font-normal text-modern-500 ml-1">tuổi</span>
                      </p>
                    </div>
                  </div>

                  {selectedSpouse.birthPlace && (
                    <div className="p-4 bg-modern-50 rounded-2xl border border-modern-100">
                      <p className="text-[10px] text-modern-400 uppercase font-bold mb-1 flex items-center gap-1">
                        <MapPin size={10} /> Nơi sinh
                      </p>
                      <p className="text-sm text-modern-900 font-medium">{selectedSpouse.birthPlace}</p>
                    </div>
                  )}

                  {selectedSpouse.burialPlace && (
                    <div className="p-4 bg-modern-50 rounded-2xl border border-modern-100">
                      <p className="text-[10px] text-modern-400 uppercase font-bold mb-1 flex items-center gap-1">
                        <MapPin size={10} /> Nơi an táng
                      </p>
                      <p className="text-sm text-modern-900 font-medium">{selectedSpouse.burialPlace}</p>
                    </div>
                  )}

                  {selectedSpouse.biography && (
                    <div className="p-4 bg-modern-50 rounded-2xl border border-modern-100">
                      <p className="text-[10px] text-modern-400 uppercase font-bold mb-1">Tiểu sử</p>
                      <p className="text-sm text-modern-700 leading-relaxed whitespace-pre-wrap italic">"{selectedSpouse.biography}"</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setSelectedSpouse(null)}
                    className="w-full py-4 bg-modern-900 text-white rounded-2xl font-bold active:scale-95 transition-transform shadow-lg shadow-modern-900/20"
                  >
                    Quay lại
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-24">
      <header className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-modern-900">Gia Phả</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            className={cn(
              "p-3 rounded-2xl transition-all",
              isSearchVisible ? "bg-modern-900 text-white" : "bg-modern-100 text-modern-600 hover:bg-modern-200"
            )}
          >
            <Search size={20} />
          </button>
          {isAdmin && (
            <button 
              onClick={() => {
                setIsAdding(true);
                setIsEditing(false);
                setNewMember({
                  ...emptyMember,
                  generation: 1,
                  order: filteredMembers.length + 1
                });
              }}
              className="p-3 bg-modern-900 text-white rounded-2xl hover:bg-modern-800 transition-colors shadow-lg shadow-modern-900/20"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isSearchVisible && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="relative mb-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-modern-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm thành viên..."
                className="w-full bg-modern-100 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-modern-400 transition-all outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {generations.length > 0 ? generations.map(gen => (
          <div key={gen} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-modern-500 uppercase tracking-widest flex items-center gap-2">
                Đời thứ {gen}
              </span>
              <div className="h-px flex-1 bg-modern-200"></div>
            </div>
            
            {filteredMembers.filter(m => m.generation === gen).map((member, i) => (
              <MemberCard 
                key={member.id} 
                member={member} 
                i={i} 
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                members={members}
                navigateToMember={navigateToMember}
                showToast={showToast}
              />
            ))}
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-modern-100 rounded-full flex items-center justify-center text-modern-300 mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-lg font-bold text-modern-900">Không tìm thấy thành viên</h3>
            <p className="text-sm text-modern-500 max-w-[200px] mt-1">
              {search ? `Không có kết quả cho "${search}"` : "Bắt đầu bằng cách thêm thành viên đầu tiên vào gia phả."}
            </p>
            {!search && (
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-6 px-6 py-3 bg-modern-900 text-white rounded-2xl font-bold text-sm"
              >
                Thêm thành viên
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
