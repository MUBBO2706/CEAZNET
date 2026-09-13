import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MoleculeViewer from './MoleculeViewer';
import { MoleculeData, UserMolecule, MoleculeViewerState } from '../types';
import { 
    Search, Loader, AlertCircle, Settings2, FlaskConical, Info, X, 
    ChevronRight, Atom, Bookmark, BookmarkPlus, BookmarkX, Trash2, 
    History, Star 
} from 'lucide-react';
import { saveLastMolecule, getLastMolecule, saveUserMolecule, getUserMolecules, deleteUserMolecule, getUserMoleculeById } from '../services/dbService';
import type { User } from '@supabase/supabase-js';

const ATOMIC_NUMBERS: Record<number, string> = {
    1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
    11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar',
    19: 'K', 20: 'Ca', 21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe', 27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn',
    31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se', 35: 'Br', 36: 'Kr', 37: 'Rb', 38: 'Sr', 39: 'Y', 40: 'Zr',
    46: 'Pd', 47: 'Ag', 48: 'Cd', 50: 'Sn', 51: 'Sb', 52: 'Te', 53: 'I', 54: 'Xe',
    78: 'Pt', 79: 'Au', 80: 'Hg', 81: 'Tl', 82: 'Pb', 83: 'Bi', 92: 'U'
};

const POPULAR_COMPOUNDS = [
    'Water', 'Carbon Dioxide', 'Methane', 'Ammonia', 'Oxygen', 
    'Ethanol', 'Caffeine', 'Aspirin', 'Glucose', 'Benzene', 
    'Ibuprofen', 'Serotonin', 'Dopamine', 'Penicillin', 'Nicotine',
    'Adrenaline', 'Melatonin', 'Testosterone', 'Cholesterol',
    'Capsaicin', 'TNT', 'Paracetamol'
];

interface ChemistryViewProps {
    customMolecule?: MoleculeData | null;
    user?: User | null;
}

const StyleRadioButton: React.FC<{ id: string; label: string; value: any; checked: boolean; onChange: (val: any) => void; }> = ({ id, label, value, checked, onChange }) => (
    <div className="flex items-center">
        <input type="radio" id={id} name={`molecule-style-${id}`} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
        <label htmlFor={id} className={`px-2 py-1.5 text-[11px] font-medium rounded-full cursor-pointer transition-colors w-full text-center ${checked ? 'bg-amber-500 text-white shadow-sm' : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-white/10'}`}>{label}</label>
    </div>
);

const CustomCheckbox: React.FC<{ id: string; label: string; checked: boolean; onChange: (val: boolean) => void; }> = ({ id, label, checked, onChange }) => (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); onChange(!checked); }}>
        <label htmlFor={id} className="text-[11px] font-medium text-neutral-700 dark:text-gray-300 cursor-pointer select-none">
            {label}
        </label>
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${checked ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-neutral-300 dark:border-gray-600'}`}>
            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        </div>
    </div>
);

const ChemistryView: React.FC<ChemistryViewProps> = ({ customMolecule, user }) => {
    const [selectedCompoundName, setSelectedCompoundName] = useState<string>('Water');
    const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
    const [savedMolecules, setSavedMolecules] = useState<UserMolecule[]>([]);
    const [deletingSavedId, setDeletingSavedId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const target = document.getElementById('floating-header-actions-portal');
        if (target) {
            setHeaderPortalTarget(target);
        }
        
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // If it's the toggle button itself, the button's onClick will handle the toggle.
                const isToggleButton = (event.target as Element).closest('#chem-menu-toggle');
                if (!isToggleButton) {
                    setIsMenuOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Viewer State
    const [viewerState, setViewerState] = useState<MoleculeViewerState>({
        showElectrons: false,
        showElectronCloud: false,
        style: 'ballAndStick',
        showHydrogens: true,
        showLabels: true,
        autoRotate: false
    });

    const isFirstLoad = useRef(true);

    // Save settings when they change (debounced)
    useEffect(() => {
        if (isFirstLoad.current) return;
        
        const timeout = setTimeout(() => {
            if (moleculeData) {
                saveLastMolecule(selectedCompoundName, viewerState, user || null);
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, [viewerState, selectedCompoundName, moleculeData, user?.id]);

    useEffect(() => {
        const init = async () => {
            try {
                // Load favorites/saved
                const saved = await getUserMolecules(user || null);
                setSavedMolecules(saved);

                if (customMolecule) {
                    setMoleculeData(customMolecule);
                    setSelectedCompoundName('Custom');
                    isFirstLoad.current = false;
                } else {
                    const last = await getLastMolecule(user || null);
                    if (last) {
                        setSelectedCompoundName(last.name);
                        if (last.settings) {
                            setViewerState(last.settings);
                        }
                        await fetchFromPubChem(last.name, false, last.settings);
                    } else {
                        setSelectedCompoundName('Water');
                        await fetchFromPubChem('Water', false);
                    }
                    isFirstLoad.current = false;
                }
            } catch (e) {
                console.error("Failed to initialize ChemistryView", e);
                fetchFromPubChem('Water', false);
                isFirstLoad.current = false;
            }
        };
        init();
    }, [customMolecule, user?.id]);

    const fetchFromPubChem = async (name: string, shouldSave: boolean = true, initialSettings?: MoleculeViewerState) => {
        setIsLoading(true);
        setError(null);
        try {
            let structureRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/record/JSON?record_type=3d`);
            if (!structureRes.ok) {
                structureRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/record/JSON?record_type=2d`);
            }
            if (!structureRes.ok) throw new Error('Compound structure not found');

            const structureData = await structureRes.json();
            const comp = structureData.PC_Compounds[0];
            const atomicNumbers = comp.atoms.element;
            const elements = atomicNumbers.map((n: number) => ATOMIC_NUMBERS[n] || 'C');
            const coords = comp.coords[0].conformers[0];
            const xs = coords.x || new Array(elements.length).fill(0);
            const ys = coords.y || new Array(elements.length).fill(0);
            const zs = coords.z || new Array(elements.length).fill(0);
            const atoms = elements.map((el: string, i: number) => ({ element: el, x: xs[i], y: ys[i], z: zs[i] || 0 }));
            const bonds = [];
            if (comp.bonds) {
                const aid1 = comp.bonds.aid1;
                const aid2 = comp.bonds.aid2;
                const order = comp.bonds.order;
                for (let i=0; i<aid1.length; i++) {
                    bonds.push({ from: aid1[i] - 1, to: aid2[i] - 1, order: order[i] });
                }
            }

            const propsRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,SMILES,ConnectivitySMILES,InChI,InChIKey,Charge,Complexity,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,TPSA,HeavyAtomCount,XLogP,ExactMass,MonoisotopicMass/JSON`);
            let props: any = {};
            if (propsRes.ok) {
                const propsData = await propsRes.json();
                if (propsData.PropertyTable && propsData.PropertyTable.Properties && propsData.PropertyTable.Properties.length > 0) {
                    props = propsData.PropertyTable.Properties[0];
                }
            }

            const iupacName = props.IUPACName || name;
            const molecularFormula = props.MolecularFormula || '';
            const molecularWeight = props.MolecularWeight ? props.MolecularWeight.toString() : '';
            
            const newData: MoleculeData = { 
                atoms, bonds, iupacName, molecularFormula, molecularWeight,
                charge: props.Charge || 0, complexity: props.Complexity || 0, 
                hBondDonorCount: props.HBondDonorCount || 0, hBondAcceptorCount: props.HBondAcceptorCount || 0, 
                rotatableBondCount: props.RotatableBondCount || 0, topologicalPolarSurfaceArea: props.TPSA || 0, 
                heavyAtomCount: props.HeavyAtomCount || 0, xLogP: props.XLogP || 0, exactMass: props.ExactMass || 0, 
                monoisotopicMass: props.MonoisotopicMass || 0, canonicalSMILES: props.CanonicalSMILES || props.SMILES || props.ConnectivitySMILES || '', 
                isomericSMILES: props.IsomericSMILES || props.SMILES || props.ConnectivitySMILES || '', inchi: props.InChI || '', inchiKey: props.InChIKey || ''
            };

            setMoleculeData(newData);
            if (shouldSave) saveLastMolecule(name, initialSettings || viewerState, user || null);
        } catch (err: any) {
            console.error("PubChem Fetch Error:", err);
            setError(err.message);
            setMoleculeData(null);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFavorite = async () => {
        if (!moleculeData) return;
        
        const existing = savedMolecules.find(m => m.name.toLowerCase() === selectedCompoundName.toLowerCase());
        
        if (existing) {
            await deleteUserMolecule(existing.id, user || null);
            setSavedMolecules(prev => prev.filter(m => m.id !== existing.id));
        } else {
            const newSaved: Partial<UserMolecule> = {
                id: crypto.randomUUID(),
                name: selectedCompoundName,
                data: moleculeData,
                settings: viewerState,
                isFavorite: true
            };
            await saveUserMolecule(newSaved, user || null);
            setSavedMolecules(prev => [{ ...newSaved, lastViewedAt: new Date().toISOString(), createdAt: new Date().toISOString() } as UserMolecule, ...prev]);
        }
    };

    const handleLoadSaved = async (molecule: UserMolecule) => {
        setIsMenuOpen(false);
        setIsLoading(true);
        try {
            const freshMolecule = await getUserMoleculeById(molecule.id, user || null);
            if (freshMolecule && freshMolecule.data) {
                setMoleculeData(freshMolecule.data);
                setSelectedCompoundName(freshMolecule.name);
                setViewerState(freshMolecule.settings);
                saveLastMolecule(freshMolecule.name, freshMolecule.settings, user || null);
            }
        } catch (err: any) {
             console.error("Failed to load saved molecule.", err);
             setError("Failed to load full structure data.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setSelectedCompoundName(searchQuery.trim());
            fetchFromPubChem(searchQuery.trim());
            setIsMenuOpen(false);
        }
    };

    const handleSelectPopular = (name: string) => {
        setSearchQuery('');
        setSelectedCompoundName(name);
        fetchFromPubChem(name);
        setIsMenuOpen(false);
    };

    const renderDropdownPanel = () => (
        <div ref={menuRef} className="absolute top-[56px] left-3 right-3 sm:left-auto sm:right-6 lg:right-10 sm:w-[380px] md:w-[440px] max-h-[calc(100dvh-80px)] overflow-y-auto custom-scrollbar bg-white/95 dark:bg-[#050505]/95 backdrop-blur-2xl border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-3 space-y-4">
            {/* Tabs - compact with width fitting the content */}
            <div className="inline-flex w-fit bg-neutral-100 dark:bg-white/5 rounded-lg p-0.5 border border-neutral-200 dark:border-white/10 shrink-0">
                <button 
                    onClick={() => setActiveTab('search')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all font-bold ${activeTab === 'search' ? 'bg-amber-500 text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                >
                    <Search className="w-3.5 h-3.5" />
                    Explorer
                </button>
                <button 
                    onClick={() => setActiveTab('saved')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all font-bold ${activeTab === 'saved' ? 'bg-amber-500 text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                >
                    <History className="w-3.5 h-3.5" />
                    Saved & History
                </button>
            </div>

            {activeTab === 'search' ? (
                <>
                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative w-full">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search compounds (e.g. Caffeine)..."
                            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-black border border-neutral-300 dark:border-white/10 text-neutral-900 dark:text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-xl transition-all shadow-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        {isLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />}
                        {searchQuery && !isLoading && (
                            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                            </button>
                        )}
                    </form>

                    {/* Popular Tags */}
                    <div>
                        <h3 className="text-[10px] md:text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                            <Star className="w-3 h-3 text-amber-500" />
                            Popular Compounds
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {POPULAR_COMPOUNDS.map(name => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => handleSelectPopular(name)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                        selectedCompoundName.toLowerCase() === name.toLowerCase()
                                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                            : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-3">
                    <h3 className="text-[10px] md:text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3 h-3 text-amber-500" />
                        Recently Saved
                    </h3>
                    {savedMolecules.length > 0 ? (
                        <div className="flex flex-col divide-y divide-neutral-100 dark:divide-white/5">
                            {savedMolecules.map(molecule => {
                                const isDeleting = deletingSavedId === molecule.id;
                                const formula = molecule.data?.molecularFormula || '';
                                const weight = molecule.data?.molecularWeight ? `${molecule.data.molecularWeight} g/mol` : '';
                                const atomCount = molecule.data?.atoms?.length ? `${molecule.data.atoms.length} atoms` : '';
                                const dateFormatted = new Date(molecule.lastViewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                                return (
                                    <div 
                                        key={molecule.id}
                                        className="group flex items-center justify-between py-2 px-1.5 rounded-lg hover:bg-neutral-100/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => {
                                            if (!isDeleting) handleLoadSaved(molecule);
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                                                <Atom className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                                        {molecule.name}
                                                    </p>
                                                    {formula && (
                                                        <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                                                            {formula}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate mt-0.5">
                                                    {[weight, atomCount, dateFormatted].filter(Boolean).join(' • ')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Delete button / Inline confirmation */}
                                        <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                                            {isDeleting ? (
                                                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-md px-2 py-0.5 animate-in fade-in zoom-in-95 duration-150">
                                                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Delete?</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            deleteUserMolecule(molecule.id, user || null);
                                                            setSavedMolecules(prev => prev.filter(m => m.id !== molecule.id));
                                                            setDeletingSavedId(null);
                                                        }}
                                                        className="text-[10px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline px-0.5"
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeletingSavedId(null)}
                                                        className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 px-0.5"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button"
                                                    onClick={() => setDeletingSavedId(molecule.id)}
                                                    className="p-1.5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
                                                    title="Delete molecule"
                                                    aria-label="Delete saved molecule"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                            <BookmarkX className="w-8 h-8 text-neutral-300 dark:text-neutral-700" />
                            <p className="text-xs text-neutral-500 font-medium">No saved molecules yet.<br/>Save your favorites to see them here.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div 
            className="absolute inset-0 w-full h-full bg-white dark:bg-black overflow-hidden flex flex-col transition-[padding-bottom] duration-200"
            style={{ paddingBottom: 'var(--dev-console-padding, 0px)' }}
        >
            
            {/* Header Portal Integration */}
            {headerPortalTarget && createPortal(
                <div className="relative pointer-events-auto flex items-center gap-1">
                    {moleculeData && (
                        <button
                            onClick={toggleFavorite}
                            className={`flex items-center justify-center p-1.5 rounded-full transition-colors ${
                                savedMolecules.some(m => m.name.toLowerCase() === selectedCompoundName.toLowerCase())
                                    ? 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400'
                                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                            }`}
                            title="Save Molecule"
                        >
                            {savedMolecules.some(m => m.name.toLowerCase() === selectedCompoundName.toLowerCase()) 
                                ? <Star className="w-5 h-5 fill-current" /> 
                                : <Star className="w-5 h-5" />
                            }
                        </button>
                    )}

                    <button
                        onClick={() => setViewerState(s => ({ ...s, showElectrons: !s.showElectrons }))}
                        className="group flex items-center justify-center p-1.5 rounded-full transition-colors tracking-tight gap-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        title="Toggle Electrons"
                    >
                        <Atom className={`w-5 h-5 mx-0.5 transition-colors ${viewerState.showElectrons ? 'text-indigo-500 hover:text-indigo-600' : 'text-current'}`} />
                        <span className="text-[13px] font-semibold hidden md:inline-block pr-1 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors">
                            Electrons
                        </span>
                    </button>
                    
                    <button
                        id="chem-menu-toggle"
                        onClick={() => {
                            setIsMenuOpen(!isMenuOpen);
                            if (!isMenuOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
                        }}
                        className={`group flex items-center justify-center p-1.5 rounded-full transition-colors tracking-tight gap-1.5 ${
                            isMenuOpen 
                                ? 'text-amber-600 dark:text-amber-400' 
                                : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'
                        }`}
                        title="Search Compounds"
                    >
                        <FlaskConical className="w-5 h-5 mx-0.5 text-amber-500 group-hover:text-amber-600 transition-colors" />
                        <span className="text-[13px] font-semibold hidden lg:inline-block pr-1 text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors">
                            {moleculeData ? (moleculeData.iupacName || selectedCompoundName) : "Search"}
                        </span>
                    </button>
                </div>,
                headerPortalTarget
            )}
            
            {isMenuOpen && renderDropdownPanel()}

            {/* --- MAIN VIEWER AREA --- */}
            <div className="flex-1 relative h-full w-full">
                {isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-all duration-300 backdrop-blur-md bg-white/30 dark:bg-black/30">
                        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="relative w-20 h-20 flex items-center justify-center">
                                <div className="absolute inset-0 border-[2px] border-amber-500/30 rounded-full animate-[spin_3s_linear_infinite]" style={{ borderRadius: '50% 50% 50% 50% / 30% 70% 30% 70%' }}></div>
                                <div className="absolute inset-0 border-[2px] border-indigo-500/30 rounded-full animate-[spin_4s_linear_infinite_reverse]" style={{ borderRadius: '50% 50% 50% 50% / 70% 30% 70% 30%' }}></div>
                                <div className="absolute inset-0 border-[2px] border-rose-500/30 rounded-full animate-[spin_5s_linear_infinite]" style={{ borderRadius: '40% 60% 40% 60% / 60% 40% 60% 40%' }}></div>
                                <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                            </div>
                            <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 tracking-wide uppercase shadow-sm">Synthesizing...</p>
                        </div>
                    </div>
                )}
                {error ? (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="flex flex-col items-center text-red-500 bg-red-50 dark:bg-red-900/10 p-8 rounded-3xl max-w-md text-center border border-red-100 dark:border-red-900/20 backdrop-blur-md">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
                            <p className="text-lg font-bold mb-2">Compound Not Found</p>
                            <p className="text-sm opacity-70 leading-relaxed">{error}</p>
                            <button 
                                onClick={() => fetchFromPubChem('Water')}
                                className="mt-6 px-6 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                                Reset to Water
                            </button>
                        </div>
                    </div>
                ) : moleculeData ? (
                    <MoleculeViewer 
                        molecule={moleculeData} 
                        isFullScreen={true} 
                        externalState={viewerState}
                        onExternalStateChange={(updates) => setViewerState(prev => ({ ...prev, ...updates }))}
                        hideControls={false}
                    />
                ) : (
                    <div className="h-full w-full" />
                )}
            </div>
        </div>
    );
};

export default ChemistryView;
