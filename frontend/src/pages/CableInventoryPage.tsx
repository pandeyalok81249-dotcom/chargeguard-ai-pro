import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Info,
  CheckCircle2,
  AlertCircle,
  AlertOctagon,
  ArrowUpDown,
  FileText,
  Clock,
  Zap,
  Eye,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { Cable, TestSessionSummary } from '../types';

export const CableInventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [cables, setCables] = useState<Cable[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectorFilter, setConnectorFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCable, setSelectedCable] = useState<Cable | null>(null);
  const [detailsCable, setDetailsCable] = useState<Cable | null>(null);
  const [detailsTests, setDetailsTests] = useState<TestSessionSummary[]>([]);
  const [isLoadingDetailsTests, setIsLoadingDetailsTests] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    cable_id: '',
    display_name: '',
    connector_type: 'USB-C to USB-C',
    cable_type: 'Braided Nylon',
    manufacturer_metadata: '',
    rated_power_w: 60,
    rated_current_a: 3.0,
    rated_voltage_v: 5.0,
    length_m: 1.0,
    serial_number: '',
    purchase_date: '',
    notes: '',
  });

  const loadCables = () => {
    api.getCables(searchQuery, connectorFilter, sortBy, sortOrder)
      .then(setCables)
      .catch((err) => console.error('Error fetching cables:', err));
  };

  useEffect(() => {
    loadCables();
  }, [searchQuery, connectorFilter, sortBy, sortOrder]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setSelectedCable(null);
    setFormData({
      cable_id: `cable-${Math.floor(100 + Math.random() * 900)}`,
      display_name: '',
      connector_type: 'USB-C to USB-C',
      cable_type: 'Braided Nylon',
      manufacturer_metadata: 'User Provided',
      rated_power_w: 60,
      rated_current_a: 3.0,
      rated_voltage_v: 5.0,
      length_m: 1.0,
      serial_number: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cable: Cable) => {
    setIsEditMode(true);
    setSelectedCable(cable);
    setFormData({
      cable_id: cable.cable_id,
      display_name: cable.display_name,
      connector_type: cable.connector_type,
      cable_type: cable.cable_type,
      manufacturer_metadata: cable.manufacturer_metadata,
      rated_power_w: cable.rated_power_w ?? 60,
      rated_current_a: cable.rated_current_a ?? 3.0,
      rated_voltage_v: cable.rated_voltage_v ?? 5.0,
      length_m: cable.length_m ?? 1.0,
      serial_number: cable.serial_number ?? '',
      purchase_date: cable.purchase_date ?? '',
      notes: cable.notes ?? '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (cable: Cable) => {
    setDetailsCable(cable);
    setIsLoadingDetailsTests(true);
    api.getTests({ cable_id: cable.cable_id, limit: 10 })
      .then(setDetailsTests)
      .catch((err) => console.error('Error loading cable test history:', err))
      .finally(() => setIsLoadingDetailsTests(false));
  };

  const handleSaveCable = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      if (isEditMode && selectedCable) {
        await api.updateCable(selectedCable.cable_id, formData);
      } else {
        await api.createCable(formData);
      }
      setIsModalOpen(false);
      loadCables();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save cable.');
    }
  };

  const handleDelete = async (cableId: string) => {
    try {
      await api.deleteCable(cableId);
      setDeleteConfirmId(null);
      if (detailsCable?.cable_id === cableId) {
        setDetailsCable(null);
      }
      loadCables();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete cable.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Cable Inventory</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {cables.length} Registered
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage tested cables and maintain separation between user claims and verified bench metrics.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-cyan-950 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Cable</span>
        </button>
      </div>

      {/* Disclaimers & Distinction Notice */}
      <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <span className="font-semibold text-slate-200">Specification Integrity Notice:</span>{' '}
          Rated wattage, current, and manufacturer names displayed in this inventory represent user-entered metadata.
          They are clearly distinguished from electrical metrics (effective resistance, voltage drop, and thermal behavior)
          verified during actual tests.
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, name, manufacturer, or serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={connectorFilter}
            onChange={(e) => setConnectorFilter(e.target.value)}
            className="bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Connectors</option>
            <option value="USB-C to USB-C">USB-C to USB-C</option>
            <option value="USB-A to USB-C">USB-A to USB-C</option>
            <option value="USB-C to Lightning">USB-C to Lightning</option>
            <option value="Micro-USB to USB-A">Micro-USB to USB-A</option>
          </select>

          <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="created_at">Date Added</option>
            <option value="display_name">Cable Name</option>
            <option value="rated_power_w">Rated Power</option>
            <option value="length_m">Length</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-300 hover:text-white"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Cable Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cables.map((c) => (
          <div
            key={c.cable_id}
            className="floating-card p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{c.display_name}</h3>
                  <div className="text-[11px] font-mono text-cyan-400 mt-0.5">{c.cable_id}</div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  {c.connector_type}
                </span>
              </div>

              {/* Specs & User Metadata */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Jacket / Build:</span>
                  <span className="text-slate-200 font-medium">{c.cable_type}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Claimed Rating:</span>
                  <span className="text-slate-200 font-medium">
                    {c.rated_power_w ? `${c.rated_power_w}W` : 'Unrated'} /{' '}
                    {c.rated_current_a ? `${c.rated_current_a}A` : 'Unrated'}
                    {c.rated_voltage_v ? ` (${c.rated_voltage_v}V)` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Length & Serial:</span>
                  <span className="text-slate-200 font-medium">
                    {c.length_m ? `${c.length_m}m` : '1.0m'} | {c.serial_number || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Manufacturer:</span>
                  <span className="text-[11px] text-slate-400 italic font-mono truncate max-w-[150px]">
                    {c.manufacturer_metadata}
                  </span>
                </div>

                {c.notes && (
                  <p className="mt-2 text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800/80">
                    "{c.notes}"
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                onClick={() => handleOpenDetails(c)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Details & History</span>
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Edit Cable Specs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(c.cable_id)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Delete Cable"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {cables.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">
            No cables match the selected filter. Click 'Add New Cable' to register one.
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {isEditMode ? 'Edit Cable Specifications' : 'Register New Cable'}
            </h3>

            {errorMessage && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveCable} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Unique Cable ID</label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  value={formData.cable_id}
                  onChange={(e) => setFormData({ ...formData, cable_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono"
                  placeholder="e.g. cable-anker-01"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Anker 60W PowerLine III"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Connector Type</label>
                  <select
                    value={formData.connector_type}
                    onChange={(e) => setFormData({ ...formData, connector_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="USB-C to USB-C">USB-C to USB-C</option>
                    <option value="USB-A to USB-C">USB-A to USB-C</option>
                    <option value="USB-C to Lightning">USB-C to Lightning</option>
                    <option value="Micro-USB to USB-A">Micro-USB to USB-A</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Jacket Material</label>
                  <select
                    value={formData.cable_type}
                    onChange={(e) => setFormData({ ...formData, cable_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Braided Nylon">Braided Nylon</option>
                    <option value="Braided Fabric">Braided Fabric</option>
                    <option value="TPE">TPE Rubber</option>
                    <option value="Silicone">Silicone Soft</option>
                    <option value="PVC">PVC Standard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Manufacturer Metadata</label>
                <input
                  type="text"
                  required
                  value={formData.manufacturer_metadata}
                  onChange={(e) => setFormData({ ...formData, manufacturer_metadata: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Anker (User Provided)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rated Power (W)</label>
                  <input
                    type="number"
                    value={formData.rated_power_w}
                    onChange={(e) => setFormData({ ...formData, rated_power_w: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rated Current (A)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.rated_current_a}
                    onChange={(e) => setFormData({ ...formData, rated_current_a: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rated Voltage (V)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.rated_voltage_v}
                    onChange={(e) => setFormData({ ...formData, rated_voltage_v: parseFloat(e.target.value) || 5.0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. 5.0 or 20.0"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cable Length (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.length_m}
                    onChange={(e) => setFormData({ ...formData, length_m: parseFloat(e.target.value) || 1.0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. 1.0, 1.8, 2.0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="e.g. SN-883921A"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Physical Condition</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Visual strain relief wear, test bench reference"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-cyan-950"
                >
                  {isEditMode ? 'Update Cable' : 'Save to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-rose-900/60 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Confirm Cable Deletion</span>
            </h4>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete cable <span className="font-mono text-cyan-300">{deleteConfirmId}</span>?
              All associated historical test sessions and measurement records will also be removed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer shadow-sm shadow-rose-950"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cable Details & History Modal */}
      {detailsCable && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{detailsCable.display_name}</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                    {detailsCable.connector_type}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">{detailsCable.cable_id}</div>
              </div>
              <button
                onClick={() => setDetailsCable(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Specifications Matrix */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                Stored Specifications
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Manufacturer</span>
                  <span className="text-slate-200 font-medium">{detailsCable.manufacturer_metadata}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Serial Number</span>
                  <span className="text-slate-200 font-mono">{detailsCable.serial_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Cable Length</span>
                  <span className="text-slate-200 font-medium">{detailsCable.length_m ? `${detailsCable.length_m} m` : '1.0 m'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Rated Power / Current</span>
                  <span className="text-slate-200 font-medium">
                    {detailsCable.rated_power_w ?? 60}W / {detailsCable.rated_current_a ?? 3.0}A
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Rated Voltage</span>
                  <span className="text-slate-200 font-medium">{detailsCable.rated_voltage_v ?? 5.0} V</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Purchase Date</span>
                  <span className="text-slate-200">{detailsCable.purchase_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Jacket / Build</span>
                  <span className="text-slate-200">{detailsCable.cable_type}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 block">Notes</span>
                  <span className="text-slate-300 italic">{detailsCable.notes || 'No notes provided.'}</span>
                </div>
              </div>
            </div>

            {/* Test History for this cable */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Previous Test Results ({detailsTests.length})
                </h4>
                <button
                  onClick={() => {
                    navigate(`/testing?cable=${detailsCable.cable_id}`);
                  }}
                  className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch Test</span>
                </button>
              </div>

              {isLoadingDetailsTests ? (
                <div className="py-6 text-center text-xs text-slate-500">Loading test history...</div>
              ) : detailsTests.length > 0 ? (
                <div className="border border-slate-800 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2 px-3">Test ID / Date</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3">Result</th>
                        <th className="py-2 px-3">Health Score</th>
                        <th className="py-2 px-3 text-right">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {detailsTests.map((t) => (
                        <tr key={t.test_id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-300">
                            <div>{t.test_id}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(t.started_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-2 px-3 uppercase text-[10px] font-mono text-slate-400">{t.mode}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              t.final_result === 'healthy' ? 'bg-emerald-950 text-emerald-300' :
                              t.final_result === 'warning' ? 'bg-amber-950 text-amber-300' :
                              t.final_result === 'critical' ? 'bg-rose-950 text-rose-300' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {(t.final_result || t.status).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {t.health_score != null ? `${t.health_score}/100` : '--'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => navigate(`/report/${t.test_id}`)}
                              className="text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-900/50 rounded-lg text-center text-xs text-slate-500 border border-slate-800">
                  No tests recorded for this cable yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailsCable(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
