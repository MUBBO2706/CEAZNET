
import React, { useState } from 'react';
import { X, Car, Bike, Plus, Trash2, Gauge, Hash, Check, Edit2 } from 'lucide-react';
import { Vehicle } from '../../types';

interface VehicleManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
    onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'user_id'>) => Promise<void>;
    onUpdateVehicle: (vehicle: Vehicle) => Promise<void>;
    onDeleteVehicle: (id: string) => Promise<void>;
}

const VehicleManagerModal: React.FC<VehicleManagerModalProps> = ({ 
    isOpen, 
    onClose, 
    vehicles, 
    onAddVehicle, 
    onUpdateVehicle,
    onDeleteVehicle 
}) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'car' | 'bike'>('bike');
    const [plate, setPlate] = useState('');
    const [odometer, setOdometer] = useState('');

    const resetForm = () => {
        setName('');
        setPlate('');
        setOdometer('');
        setType('bike');
        setEditingId(null);
        setIsFormOpen(false);
    };

    const handleEditClick = (v: Vehicle) => {
        setEditingId(v.id);
        setName(v.name);
        setType(v.type);
        setPlate(v.number_plate);
        setOdometer(v.current_odometer.toString());
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        
        const vehicleData = {
            name,
            type,
            number_plate: plate,
            current_odometer: parseFloat(odometer) || 0
        };

        if (editingId) {
            // Update existing
            const vehicleToUpdate = vehicles.find(v => v.id === editingId);
            if (vehicleToUpdate) {
                await onUpdateVehicle({
                    ...vehicleToUpdate,
                    ...vehicleData
                });
            }
        } else {
            // Add new
            await onAddVehicle(vehicleData);
        }
        
        resetForm();
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
                onClick={handleClose} 
            />
            
            <div className="relative w-full max-w-sm transform transition-all animate-fade-in-up">
                 <div className="relative bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[85vh]">
                    
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 shadow-sm">
                                <Car className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">My Fleet</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Manage your vehicles</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto scrollbar-hide">
                        {/* Vehicle List */}
                        {!isFormOpen && (
                            <div className="space-y-3 mb-6">
                                {vehicles.map(v => (
                                    <div key={v.id} className="group relative bg-white dark:bg-black/20 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-red-200 dark:hover:border-red-900/30 transition-all">
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-3">
                                                <div className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-600 dark:text-gray-300">
                                                    {v.type === 'car' ? <Car className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white">{v.name}</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{v.number_plate}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEditClick(v)}
                                                    className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteVehicle(v.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <Gauge className="w-3.5 h-3.5" />
                                            <span>Current: <span className="font-bold text-gray-900 dark:text-white">{v.current_odometer.toLocaleString()} km</span></span>
                                        </div>
                                    </div>
                                ))}
                                
                                {vehicles.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                        <Car className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">No vehicles added yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Add/Edit Form */}
                        {isFormOpen ? (
                            <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-200 dark:border-white/5 animate-fade-in-up">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
                                    </h3>
                                    <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setType('bike')}
                                            className={`p-2 rounded-xl text-xs font-bold border transition-all ${type === 'bike' ? 'bg-white dark:bg-black/40 border-red-500 text-red-500 shadow-sm' : 'border-transparent text-gray-500 hover:bg-white/50'}`}
                                        >
                                            Bike
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setType('car')}
                                            className={`p-2 rounded-xl text-xs font-bold border transition-all ${type === 'car' ? 'bg-white dark:bg-black/40 border-red-500 text-red-500 shadow-sm' : 'border-transparent text-gray-500 hover:bg-white/50'}`}
                                        >
                                            Car
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <input 
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Vehicle Name (e.g. Honda City)"
                                            className="w-full pl-4 pr-4 py-3 rounded-xl bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text"
                                                value={plate}
                                                onChange={e => setPlate(e.target.value)}
                                                placeholder="Plate No."
                                                className="w-full pl-9 pr-3 py-3 rounded-xl bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 uppercase"
                                            />
                                        </div>
                                        <div className="relative flex-1">
                                            <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="number"
                                                value={odometer}
                                                onChange={e => setOdometer(e.target.value)}
                                                placeholder="Odometer"
                                                className="w-full pl-9 pr-3 py-3 rounded-xl bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                                    >
                                        <Check className="w-4 h-4" /> 
                                        {editingId ? 'Update Vehicle' : 'Save Vehicle'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button 
                                onClick={() => setIsFormOpen(true)}
                                className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-red-500 dark:hover:text-red-400 transition-all font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Vehicle
                            </button>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default VehicleManagerModal;
