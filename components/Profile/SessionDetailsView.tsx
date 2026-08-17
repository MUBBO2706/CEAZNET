import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Download, 
  MoreVertical, 
  Trash2, 
  ShieldAlert, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  MapPin, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Calendar, 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  X,
  ShieldCheck,
  Zap,
  Info,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../ToastSystem';
import ConfirmationModal from '../ConfirmationModal';
import { getExactDeviceName } from '../../utils/deviceUtils';

export interface SessionItem {
  id: string;
  user_id?: string;
  session_key: string;
  device_id?: string;
  device_name?: string;
  ip_address?: string;
  location?: string;
  battery_percentage?: number;
  created_at: string;
  last_active_at?: string;
  is_current?: boolean;
  browser_name?: string;
  is_incognito?: boolean;
  action_by?: string;
  action_from?: string;
}

interface SessionDetailsViewProps {
  sessions: SessionItem[];
  currentSessionKey: string;
  currentDeviceId?: string;
  userEmail?: string;
  userName?: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onTerminateSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onTerminateAllOther: () => Promise<void>;
  onDeleteAllInactive: () => Promise<void>;
  isLoading?: boolean;
}

type StatusFilter = 'all' | 'active' | 'logged_out' | 'terminated' | 'expired';
type TimeRangeFilter = 'all' | '24h' | '7d' | '30d' | 'custom';
type SortOption = 'newest' | 'oldest' | 'browser_asc' | 'os_asc';

export const parseDeviceAndOS = (deviceName?: string): { device: string; os: string } => {
  if (!deviceName) return { device: 'Generic Web Device', os: 'Unknown OS' };

  let raw = deviceName.trim();
  let os = '';
  let device = raw;

  // Check for embedded OS in parentheses or brackets e.g. "2201116PI (Android)" or "PC [Windows]"
  const parenMatch = raw.match(/^(.*?)\s*[\(\[](.*?)[\)\]]\s*$/);
  if (parenMatch) {
    device = parenMatch[1].trim();
    const inside = parenMatch[2].trim();
    if (inside) os = inside;
  }

  const upperRaw = raw.toUpperCase();
  const upperDevice = device.toUpperCase();
  const upperOs = os.toUpperCase();

  // Normalize OS if found or check string hints
  if (upperOs.includes('ANDROID') || upperRaw.includes('ANDROID')) {
    os = 'Android';
  } else if (upperOs.includes('WINDOWS') || upperRaw.includes('WINDOWS') || upperRaw.includes('WIN')) {
    os = 'Windows';
  } else if (upperOs.includes('MAC') || upperRaw.includes('MACOS') || upperRaw.includes('MACINTOSH') || upperRaw.includes('OS X')) {
    os = 'macOS';
  } else if (upperOs.includes('IOS') || upperOs.includes('IPHONE') || upperOs.includes('IPAD') || upperRaw.includes('IPHONE') || upperRaw.includes('IPAD')) {
    os = 'iOS';
  } else if (upperOs.includes('LINUX') || upperRaw.includes('LINUX') || upperRaw.includes('UBUNTU')) {
    os = 'Linux';
  }

  // Fallback OS detection if still unknown/empty based on device model patterns
  if (!os || os === 'Unknown OS') {
    if (
      upperDevice.includes('POCO') ||
      upperDevice.includes('REDMI') ||
      upperDevice.includes('XIAOMI') ||
      upperDevice.includes('SAMSUNG') ||
      upperDevice.includes('GALAXY') ||
      upperDevice.includes('SM-') ||
      upperDevice.includes('OPPO') ||
      upperDevice.includes('VIVO') ||
      upperDevice.includes('ONEPLUS') ||
      upperDevice.includes('PIXEL') ||
      upperDevice.includes('REALME') ||
      upperDevice.includes('HUAWEI') ||
      upperDevice.includes('HTC') ||
      upperDevice.includes('2201116') ||
      upperDevice.includes('2511FRT') ||
      upperDevice.includes('CPH') ||
      upperDevice.includes('SGH') ||
      upperDevice.includes('ADR')
    ) {
      os = 'Android';
    } else if (upperDevice.includes('IPHONE')) {
      os = 'iOS';
    } else if (upperDevice.includes('IPAD')) {
      os = 'iPadOS';
    } else if (upperDevice.includes('MAC') || upperDevice.includes('MACBOOK')) {
      os = 'macOS';
    } else if (upperDevice.includes('PC') || upperDevice.includes('WINDOWS') || upperDevice.includes('DEKSTOP') || upperDevice.includes('DESKTOP') || upperDevice.includes('SYSTEM')) {
      os = 'Windows';
    } else {
      os = 'Unknown OS';
    }
  }

  if (!device) {
    device = raw.replace(/[\(\[\)\]]/g, '').trim() || 'Generic Device';
  }

  return { device, os };
};

export const getSessionActions = (
  session: SessionItem, 
  userName?: string, 
  userEmail?: string
): { actionBy: string; actionFrom: string } => {
  const key = session.session_key || '';
  let status: 'active' | 'logged_out' | 'terminated' | 'expired' = 'active';
  if (key.startsWith('LOGGED_OUT_')) {
    status = 'logged_out';
  } else if (key.startsWith('TERMINATED_')) {
    status = 'terminated';
  } else {
    const now = Date.now();
    const lastActive = new Date(session.last_active_at || session.created_at).getTime();
    if (now - lastActive > 35 * 60 * 1000 && !session.is_current && session.session_key !== 'current') {
      status = 'expired';
    }
  }

  // Active/ongoing sessions have no termination action yet
  if (status === 'active') {
    return {
      actionBy: '-',
      actionFrom: 'Ongoing'
    };
  }

  if (session.action_by) {
    return {
      actionBy: session.action_by,
      actionFrom: session.action_from || parseDeviceAndOS(session.device_name).device
    };
  }

  const displayName = userName || userEmail || 'User';

  if (status === 'expired') {
    return {
      actionBy: 'System',
      actionFrom: 'System'
    };
  }

  if (status === 'logged_out') {
    if (key.includes('SYSTEM') || key.includes('EXPIRED') || key.includes('TIMEOUT')) {
      return {
        actionBy: 'System',
        actionFrom: 'System'
      };
    }
    return {
      actionBy: displayName,
      actionFrom: parseDeviceAndOS(session.device_name).device
    };
  }

  if (status === 'terminated') {
    const byIndex = key.indexOf('_BY_');
    const locIndex = key.indexOf('_LOC_');
    let terminatorDevice = '';
    if (byIndex !== -1) {
      const rawDevice = locIndex !== -1 ? key.substring(byIndex + 4, locIndex) : key.substring(byIndex + 4);
      try {
        terminatorDevice = decodeURIComponent(rawDevice);
      } catch (e) {
        terminatorDevice = rawDevice;
      }
    }

    const parsedTerminator = terminatorDevice ? parseDeviceAndOS(terminatorDevice).device : 'Unknown Device';

    if (key.toUpperCase().includes('_BY_ADMIN')) {
      return {
        actionBy: 'Admin',
        actionFrom: 'Admin Panel'
      };
    }

    if (key.toUpperCase().includes('_BY_SYSTEM') || key.toUpperCase().includes('_BY_HEARTBEAT')) {
      return {
        actionBy: 'System',
        actionFrom: 'System'
      };
    }

    return {
      actionBy: displayName,
      actionFrom: parsedTerminator
    };
  }

  return {
    actionBy: displayName,
    actionFrom: parseDeviceAndOS(session.device_name).device
  };
};

export const SessionDetailsView: React.FC<SessionDetailsViewProps> = ({
  sessions,
  currentSessionKey,
  currentDeviceId,
  userEmail,
  userName,
  onBack,
  onRefresh,
  onTerminateSession,
  onDeleteSession,
  onTerminateAllOther,
  onDeleteAllInactive,
  isLoading = false,
}) => {
  const { addToast } = useToast();

  const [resolvedSessions, setResolvedSessions] = useState<SessionItem[]>(sessions);

  useEffect(() => {
    setResolvedSessions(sessions);
    
    let isCurrentEffect = true;
    const resolveNames = async () => {
      try {
        const { resolveDeviceName } = await import('../../utils/deviceUtils');
        const resolvedList = await Promise.all(
          sessions.map(async (s) => {
            if (s.device_name) {
              try {
                const resolvedName = await resolveDeviceName(s.device_name);
                return { ...s, device_name: resolvedName };
              } catch (e) {
                return s;
              }
            }
            return s;
          })
        );
        if (isCurrentEffect) {
          setResolvedSessions(resolvedList);
        }
      } catch (err) {
        console.warn('Failed to resolve device names in details view:', err);
      }
    };
    resolveNames();
    return () => {
      isCurrentEffect = false;
    };
  }, [sessions]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [durationFormat, setDurationFormat] = useState<'human' | 'hms'>('human');

  // Dropdown states
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTimeRangeDropdownOpen, setIsTimeRangeDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isRowsPerPageDropdownOpen, setIsRowsPerPageDropdownOpen] = useState(false);

  // Floating Header Portal
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateContainer = () => {
      const el = document.getElementById('floating-header-actions-portal');
      setPortalContainer(el);
    };
    updateContainer();
    const timer = setTimeout(updateContainer, 100);
    return () => clearTimeout(timer);
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selected Session for Detail Modal
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<SessionItem | null>(null);
  const [isCopiedDetails, setIsCopiedDetails] = useState(false);

  // Inline row action state
  const [confirmingTerminateId, setConfirmingTerminateId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isRowActionRunning, setIsRowActionRunning] = useState<string | null>(null);
  
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to actions when confirming
  useEffect(() => {
    if ((confirmingTerminateId || confirmingDeleteId) && tableScrollRef.current) {
      setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollTo({
            left: tableScrollRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [confirmingTerminateId, confirmingDeleteId]);

  // Confirmation Modals
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDangerous: boolean;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    isDangerous: true,
    action: async () => {},
  });

  // Calculate session status
  const getSessionStatus = (session: SessionItem): { status: 'active' | 'logged_out' | 'terminated' | 'expired'; label: string } => {
    const key = session.session_key || '';
    if (key.startsWith('LOGGED_OUT_')) {
      return { status: 'logged_out', label: 'Logged Out' };
    }
    if (key.startsWith('TERMINATED_')) {
      return { status: 'terminated', label: 'Terminated' };
    }

    const now = Date.now();
    const lastActive = new Date(session.last_active_at || session.created_at).getTime();
    // Inactive if more than 35 minutes without heartbeat
    if (now - lastActive > 35 * 60 * 1000 && !session.is_current && session.session_key !== currentSessionKey) {
      return { status: 'expired', label: 'Expired' };
    }

    return { status: 'active', label: 'Active' };
  };

  // Helper to format date & time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '-', time: '-' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '-', time: '-' };

    const date = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    return { date, time, full: `${date} at ${time}` };
  };

  // Format date & time on a single line
  const formatSingleLineDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    try {
      const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      };
      return new Intl.DateTimeFormat('en-GB', options).format(d).replace(',', '');
    } catch (e) {
      return d.toLocaleString('en-IN');
    }
  };

  // Duration calculation
  const getDuration = (startStr: string, endStr?: string, isOngoing: boolean = false) => {
    const start = new Date(startStr).getTime();
    const end = isOngoing ? Date.now() : new Date(endStr || startStr).getTime();
    const diffMs = Math.max(0, end - start);

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (durationFormat === 'hms') {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    // Human format
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Device Icon resolver
  const getDeviceIcon = (deviceName?: string) => {
    const name = (deviceName || '').toLowerCase();
    if (name.includes('iphone') || name.includes('android') || name.includes('mobile') || name.includes('samsung') || name.includes('pixel') || name.includes('oneplus')) {
      return <Smartphone className="w-4 h-4 text-indigo-500" />;
    }
    if (name.includes('mac') || name.includes('windows') || name.includes('linux') || name.includes('laptop') || name.includes('desktop')) {
      return <Laptop className="w-4 h-4 text-blue-500" />;
    }
    return <Globe className="w-4 h-4 text-emerald-500" />;
  };

  // Filtered & Sorted sessions
  const filteredSessions = useMemo(() => {
    return resolvedSessions.filter((s) => {
      const actions = getSessionActions(s, userName, userEmail);
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIp = (s.ip_address || '').toLowerCase().includes(q);
        const matchDevice = (s.device_name || '').toLowerCase().includes(q);
        const matchLocation = (s.location || '').toLowerCase().includes(q);
        const matchKey = (s.session_key || '').toLowerCase().includes(q);
        const matchId = (s.id || '').toLowerCase().includes(q);
        const matchActionBy = (actions.actionBy || '').toLowerCase().includes(q);
        const matchActionFrom = (actions.actionFrom || '').toLowerCase().includes(q);
        if (!matchIp && !matchDevice && !matchLocation && !matchKey && !matchId && !matchActionBy && !matchActionFrom) {
          return false;
        }
      }

      // 2. Status Filter
      const statusInfo = getSessionStatus(s);
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && statusInfo.status !== 'active') return false;
        if (statusFilter === 'logged_out' && statusInfo.status !== 'logged_out') return false;
        if (statusFilter === 'terminated' && statusInfo.status !== 'terminated') return false;
        if (statusFilter === 'expired' && statusInfo.status !== 'expired') return false;
      }

      // 3. Time Range Filter
      if (timeRangeFilter !== 'all') {
        const sessionTime = new Date(s.created_at).getTime();
        const now = Date.now();
        if (timeRangeFilter === '24h' && now - sessionTime > 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === '7d' && now - sessionTime > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === '30d' && now - sessionTime > 30 * 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === 'custom') {
          if (customStartDate && sessionTime < new Date(customStartDate).getTime()) return false;
          if (customEndDate && sessionTime > new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === 'browser_asc') {
        return (a.device_name || '').localeCompare(b.device_name || '');
      }
      if (sortOption === 'os_asc') {
        return (a.device_name || '').localeCompare(b.device_name || '');
      }
      return 0;
    });
  }, [resolvedSessions, searchQuery, statusFilter, timeRangeFilter, customStartDate, customEndDate, sortOption, currentSessionKey]);

  // Paginated Sessions
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, timeRangeFilter, sortOption, itemsPerPage]);

  // Export as PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape');
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('Ceaznet - Active Session Registry & Audit History', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()} (IST) | User: ${userName || userEmail || 'Ceaznet User'}`, 14, 28);
      doc.text(`Total Sessions Logged: ${filteredSessions.length}`, 14, 34);

      const tableData = filteredSessions.map((s, idx) => {
        const start = formatDateTime(s.created_at).full;
        const statusInfo = getSessionStatus(s);
        const end = statusInfo.status === 'active' ? 'Ongoing (Active)' : formatDateTime(s.last_active_at).full;
        const duration = getDuration(s.created_at, s.last_active_at, statusInfo.status === 'active');
        const isCur = s.is_current || s.session_key === currentSessionKey ? '(Current)' : '';
        const actions = getSessionActions(s, userName, userEmail);

        const battery = s.battery_percentage !== undefined && s.battery_percentage !== null ? `${s.battery_percentage}%` : 'N/A';

        return [
          (idx + 1).toString(),
          start,
          end,
          duration,
          `${s.device_name || 'Generic Device'} ${isCur}`.trim(),
          s.ip_address || '-',
          s.location || 'Unknown',
          battery,
          actions.actionBy,
          actions.actionFrom,
          statusInfo.label,
        ];
      });

      autoTable(doc, {
        head: [['#', 'Started At', 'End Time', 'Duration', 'Device & OS', 'IP Address', 'Location', 'Battery', 'Action By', 'Action From', 'Status']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`ceaznet_sessions_audit_${new Date().toISOString().slice(0, 10)}.pdf`);
      addToast('PDF audit report downloaded successfully!', 'success');
      setIsExportDropdownOpen(false);
    } catch (e: any) {
      console.error('PDF export failed:', e);
      addToast('Failed to generate PDF audit report.', 'error');
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'Started At', 'Last Active / End Time', 'Duration', 'Device & OS', 'IP Address', 'Location', 'Battery', 'Action By', 'Action From', 'Status', 'Is Current Session'];
      const rows = filteredSessions.map((s) => {
        const statusInfo = getSessionStatus(s);
        const isCur = s.is_current || s.session_key === currentSessionKey ? 'YES' : 'NO';
        const start = formatDateTime(s.created_at).full;
        const end = statusInfo.status === 'active' ? 'Ongoing' : formatDateTime(s.last_active_at).full;
        const duration = getDuration(s.created_at, s.last_active_at, statusInfo.status === 'active');
        const battery = s.battery_percentage !== undefined && s.battery_percentage !== null ? `${s.battery_percentage}%` : 'N/A';
        const actions = getSessionActions(s, userName, userEmail);

        return [
          `"${s.id || ''}"`,
          `"${start}"`,
          `"${end}"`,
          `"${duration}"`,
          `"${(s.device_name || '').replace(/"/g, '""')}"`,
          `"${s.ip_address || ''}"`,
          `"${(s.location || '').replace(/"/g, '""')}"`,
          `"${battery}"`,
          `"${(actions.actionBy || '').replace(/"/g, '""')}"`,
          `"${(actions.actionFrom || '').replace(/"/g, '""')}"`,
          `"${statusInfo.label}"`,
          `"${isCur}"`,
        ].join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ceaznet_sessions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('CSV sessions data exported successfully!', 'success');
      setIsExportDropdownOpen(false);
    } catch (e) {
      addToast('Failed to export CSV.', 'error');
    }
  };

  // Export as JSON
  const handleExportJSON = () => {
    try {
      const exportObj = {
        app: 'Ceaznet',
        exported_at: new Date().toISOString(),
        user: { name: userName, email: userEmail },
        total_records: filteredSessions.length,
        sessions: filteredSessions.map(s => {
          const actions = getSessionActions(s, userName, userEmail);
          return {
            ...s,
            action_by: actions.actionBy,
            action_from: actions.actionFrom,
            computed_status: getSessionStatus(s).label,
            is_current_session: s.is_current || s.session_key === currentSessionKey
          };
        })
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `ceaznet_sessions_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('JSON dataset exported successfully!', 'success');
      setIsExportDropdownOpen(false);
    } catch (e) {
      addToast('Failed to export JSON.', 'error');
    }
  };

  // Copy session details from modal
  const handleCopyModalDetails = () => {
    if (!selectedSessionForModal) return;
    const s = selectedSessionForModal;
    const statusInfo = getSessionStatus(s);
    const actions = getSessionActions(s, userName, userEmail);
    const text = [
      `--- Ceaznet Session Record ---`,
      `Device: ${s.device_name || 'Unknown Device'}`,
      `IP Address: ${s.ip_address || 'N/A'}`,
      `Location: ${s.location || 'N/A'}`,
      `Started: ${formatDateTime(s.created_at).full}`,
      `Last Active: ${formatDateTime(s.last_active_at).full}`,
      `Action By: ${actions.actionBy}`,
      `Action From: ${actions.actionFrom}`,
      `Status: ${statusInfo.label}`,
      `Session ID: ${s.id || s.session_key}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setIsCopiedDetails(true);
    setTimeout(() => setIsCopiedDetails(false), 2000);
    addToast('Session details copied to clipboard!', 'success');
  };

  // Confirmation triggers
  const promptTerminateSingle = (session: SessionItem) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Terminate Active Session?',
      message: `Are you sure you want to remotely terminate this active session on "${session.device_name || 'Device'}" (${session.ip_address || 'IP'})? The device will be immediately signed out.`,
      confirmText: 'Terminate Session',
      isDangerous: true,
      action: async () => {
        await onTerminateSession(session.id);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const promptDeleteSingle = (session: SessionItem) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Inactive Record?',
      message: `Are you sure you want to permanently delete the audit record for this session (${session.device_name || 'Device'})? This action cannot be undone.`,
      confirmText: 'Delete Record',
      isDangerous: true,
      action: async () => {
        await onDeleteSession(session.id);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const promptTerminateAllOther = () => {
    setIsActionsDropdownOpen(false);
    setConfirmModalConfig({
      isOpen: true,
      title: 'Terminate All Other Sessions?',
      message: 'This will instantly disconnect and log out all active sessions across all your devices, preserving only your current active session on this device.',
      confirmText: 'Terminate All Others',
      isDangerous: true,
      action: async () => {
        setIsBulkRunning(true);
        setConfirmModalConfig(prev => ({ ...prev, confirmText: 'Terminating...' }));
        try {
          await onTerminateAllOther();
        } finally {
          setIsBulkRunning(false);
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const promptDeleteAllInactive = () => {
    setIsActionsDropdownOpen(false);
    setConfirmModalConfig({
      isOpen: true,
      title: 'Clear All Inactive Sessions?',
      message: 'This will permanently remove all past terminated, logged out, and expired session audit logs from your account.',
      confirmText: 'Clear Inactive Records',
      isDangerous: true,
      action: async () => {
        setIsBulkRunning(true);
        setConfirmModalConfig(prev => ({ ...prev, confirmText: 'Deleting...' }));
        try {
          await onDeleteAllInactive();
        } finally {
          setIsBulkRunning(false);
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const activeCount = useMemo(() => {
    return sessions.filter(s => getSessionStatus(s).status === 'active').length;
  }, [sessions, currentSessionKey]);

  const otherActiveSessionsCount = useMemo(() => {
    return sessions.filter(s => getSessionStatus(s).status === 'active' && !s.is_current && s.session_key !== currentSessionKey).length;
  }, [sessions, currentSessionKey]);

  const deletableInactiveSessionsCount = useMemo(() => {
    return sessions.filter(s => getSessionStatus(s).status !== 'active' && !s.is_current && s.session_key !== currentSessionKey).length;
  }, [sessions, currentSessionKey]);

  const statusLabels: Record<StatusFilter, string> = {
    all: 'All Statuses',
    active: 'Active Only',
    logged_out: 'Logged Out',
    terminated: 'Terminated',
    expired: 'Expired',
  };

  const timeLabels: Record<TimeRangeFilter, string> = {
    all: 'All Time',
    '24h': 'Past 24 Hours',
    '7d': 'Past 7 Days',
    '30d': 'Past 30 Days',
    custom: 'Custom Range',
  };

  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest First',
    oldest: 'Oldest First',
    browser_asc: 'Device Name (A-Z)',
    os_asc: 'OS (A-Z)'
  };

  return (
    <div className="relative z-10 h-full overflow-y-auto bg-gray-50 dark:bg-black transition-colors duration-300 pt-16 sm:pt-18 md:pt-20 pb-12 dev-console-spacing-pb">
      {/* Floating Header Export Portal */}
      {portalContainer && createPortal(
        <div className="relative flex items-center">
          <button
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all focus:outline-none cursor-pointer"
            title="Export Session Data"
          >
            <Download className="h-5 w-5" />
          </button>
          {isExportDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsExportDropdownOpen(false)} />
              <div 
                className="absolute right-0 top-full mt-3.5 w-52 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 backdrop-blur-xl"
              >
                <button
                  onClick={() => {
                    handleExportPDF();
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-[var(--profile-text-primary)] hover:bg-[var(--profile-card-subtle-bg)] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-medium">Export as PDF Audit</span>
                </button>
                <button
                  onClick={() => {
                    handleExportCSV();
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-[var(--profile-text-primary)] hover:bg-[var(--profile-card-subtle-bg)] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-medium">Export as Excel / CSV</span>
                </button>
                <button
                  onClick={() => {
                    handleExportJSON();
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-[var(--profile-text-primary)] hover:bg-[var(--profile-card-subtle-bg)] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium">Export as JSON</span>
                </button>
              </div>
            </>
          )}
        </div>,
        portalContainer
      )}

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-4 space-y-6">
        {/* Top Header - Separate Rows for Heading & Full-Width Description */}
        <div className="border-b border-[var(--profile-card-border)] pb-4 space-y-1">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-bold text-[var(--profile-text-primary)]">
              Session History
            </h1>
            {/* Bulk Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsActionsDropdownOpen(!isActionsDropdownOpen);
                  setIsExportDropdownOpen(false);
                }}
                className="p-0 bg-transparent border-0 text-[var(--profile-text-secondary)] hover:text-[var(--profile-accent)] transition-colors cursor-pointer focus:outline-none flex items-center justify-center"
                title="Bulk Actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {isActionsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsActionsDropdownOpen(false)} />
                  <div 
                    className="absolute right-0 mt-2 w-56 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95"
                  >
                    <button
                      onClick={promptTerminateAllOther}
                      disabled={otherActiveSessionsCount === 0}
                      className="w-full px-3.5 py-2 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-[var(--profile-card-subtle-bg)] flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Terminate All Other Sessions</span>
                    </button>
                    <button
                      onClick={promptDeleteAllInactive}
                      disabled={deletableInactiveSessionsCount === 0}
                      className="w-full px-3.5 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-[var(--profile-card-subtle-bg)] flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Clear All Inactive Records</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--profile-text-muted)] w-full leading-relaxed">
            Comprehensive real-time device audit trail, active token connection codex, and remote access manager.
          </p>
        </div>

        {/* Toolbar & Filters (Containerless) */}
        <div className="space-y-3.5">
          <div className="flex flex-col md:flex-row gap-2 w-full">
            {/* Search Bar */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--profile-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by IP, device, browser, OS, city..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-[var(--profile-input-bg)] text-[var(--profile-input-text)] border border-[var(--profile-input-border)] focus:outline-none focus:border-[var(--profile-accent)] transition-colors h-full min-h-[36px]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--profile-text-muted)] hover:text-[var(--profile-text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status, Sort, Time Range Row - Side-by-side on mobile */}
            <div className="flex gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <div className="relative flex-1 md:flex-none min-w-0">
                <button
                  onClick={() => {
                    setIsStatusDropdownOpen(!isStatusDropdownOpen);
                    setIsTimeRangeDropdownOpen(false);
                    setIsSortDropdownOpen(false);
                  }}
                  className="w-full md:w-auto px-2 md:px-3 py-2 rounded-xl text-xs bg-[var(--profile-input-bg)] text-[var(--profile-input-text)] border border-[var(--profile-input-border)] hover:bg-[var(--profile-table-row-hover)] transition-colors flex items-center justify-between md:justify-start gap-1.5 cursor-pointer font-medium h-full min-h-[36px]"
                >
                  <span className="truncate">Status: {statusLabels[statusFilter]}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsStatusDropdownOpen(false)} />
                    <div className="absolute left-0 mt-1.5 w-48 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                      {(['all', 'active', 'logged_out', 'terminated', 'expired'] as StatusFilter[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setStatusFilter(opt);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-[var(--profile-table-row-hover)] flex items-center justify-between transition-colors ${statusFilter === opt ? 'text-[var(--profile-accent)] font-semibold' : 'text-[var(--profile-text-secondary)]'}`}
                        >
                          <span className="truncate">{statusLabels[opt]}</span>
                          {statusFilter === opt && <Check className="w-3.5 h-3.5 text-[var(--profile-accent)] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Sort Filter */}
              <div className="relative flex-1 md:flex-none min-w-0">
                <button
                  onClick={() => {
                    setIsSortDropdownOpen(!isSortDropdownOpen);
                    setIsStatusDropdownOpen(false);
                    setIsTimeRangeDropdownOpen(false);
                  }}
                  className="w-full md:w-auto px-2 md:px-3 py-2 rounded-xl text-xs bg-[var(--profile-input-bg)] text-[var(--profile-input-text)] border border-[var(--profile-input-border)] hover:bg-[var(--profile-table-row-hover)] transition-colors flex items-center justify-between md:justify-start gap-1.5 cursor-pointer font-medium h-full min-h-[36px]"
                >
                  <span className="truncate">Sort: {sortLabels[sortOption]}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
                {isSortDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsSortDropdownOpen(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-1.5 w-48 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                      {(['newest', 'oldest', 'browser_asc', 'os_asc'] as SortOption[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setSortOption(opt);
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-[var(--profile-table-row-hover)] flex items-center justify-between transition-colors ${sortOption === opt ? 'text-[var(--profile-accent)] font-semibold' : 'text-[var(--profile-text-secondary)]'}`}
                        >
                          <span className="truncate">{sortLabels[opt]}</span>
                          {sortOption === opt && <Check className="w-3.5 h-3.5 text-[var(--profile-accent)] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Time Range Filter */}
              <div className="relative flex-1 md:flex-none min-w-0">
                <button
                  onClick={() => {
                    setIsTimeRangeDropdownOpen(!isTimeRangeDropdownOpen);
                    setIsStatusDropdownOpen(false);
                    setIsSortDropdownOpen(false);
                  }}
                  className="w-full md:w-auto px-2 md:px-3 py-2 rounded-xl text-xs bg-[var(--profile-input-bg)] text-[var(--profile-input-text)] border border-[var(--profile-input-border)] hover:bg-[var(--profile-table-row-hover)] transition-colors flex items-center justify-between md:justify-start gap-1.5 cursor-pointer font-medium h-full min-h-[36px]"
                >
                  <span className="truncate">Time: {timeLabels[timeRangeFilter]}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
                {isTimeRangeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsTimeRangeDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-48 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                      {(['all', '24h', '7d', '30d', 'custom'] as TimeRangeFilter[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setTimeRangeFilter(opt);
                            setIsTimeRangeDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-[var(--profile-table-row-hover)] flex items-center justify-between transition-colors ${timeRangeFilter === opt ? 'text-[var(--profile-accent)] font-semibold' : 'text-[var(--profile-text-secondary)]'}`}
                        >
                          <span className="truncate">{timeLabels[opt]}</span>
                          {timeRangeFilter === opt && <Check className="w-3.5 h-3.5 text-[var(--profile-accent)] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

      {/* Custom Date Range Picker (Container-less, Single Row on Mobile) */}
      {timeRangeFilter === 'custom' && (
        <div className="flex items-center gap-2.5 text-xs overflow-x-auto no-scrollbar whitespace-nowrap py-1">
          <div className="flex items-center gap-1.5 text-[var(--profile-text-muted)] shrink-0 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[var(--profile-accent)]" />
            <span className="hidden sm:inline">Range:</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[var(--profile-text-muted)] text-[11px]">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--profile-card-bg)] text-[var(--profile-input-text)] border border-[var(--profile-card-border)] focus:outline-none focus:border-[var(--profile-accent)] text-[11px] font-mono cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[var(--profile-text-muted)] text-[11px]">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--profile-card-bg)] text-[var(--profile-input-text)] border border-[var(--profile-card-border)] focus:outline-none focus:border-[var(--profile-accent)] text-[11px] font-mono cursor-pointer"
            />
          </div>
          {(customStartDate || customEndDate) && (
            <button
              onClick={() => {
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-[11px] text-[var(--profile-accent)] hover:underline ml-auto shrink-0 font-medium px-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}
      </div>

      {/* Table Card */}
      <div className="flex flex-col">
        <div ref={tableScrollRef} className="overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 md:-mx-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] border-t border-b border-gray-200 dark:border-white/10 bg-white/40 dark:bg-neutral-950/20 text-left">
          <table className="w-full text-left font-mono text-[10px] leading-normal border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-neutral-950/20 text-gray-500 dark:text-neutral-400 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 text-[8px]">
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session Start</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session End</th>
                <th 
                  onClick={() => setDurationFormat(prev => prev === 'human' ? 'hms' : 'human')}
                  className="py-2.5 px-3 font-semibold text-left whitespace-nowrap cursor-pointer hover:text-[var(--profile-accent)] transition-colors select-none"
                  title="Click to toggle format (Words vs HH:MM:SS)"
                >
                  Duration
                </th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Device</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Browser</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Mode</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">OS</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">IP Address</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Location</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Battery</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap text-amber-600 dark:text-amber-400">Action By</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap text-blue-600 dark:text-blue-400">Action From</th>
                <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/70 dark:divide-white/15 text-gray-700 dark:text-neutral-300">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[var(--profile-text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-[var(--profile-text-muted)] opacity-50" />
                      <p className="font-medium">No matching sessions found</p>
                      <p className="text-[11px]">Try adjusting your search query or status filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => {
                  const statusInfo = getSessionStatus(session);
                  const isCurrent = session.is_current || session.session_key === currentSessionKey;
                  const durationStr = getDuration(session.created_at, session.last_active_at, statusInfo.status === 'active');

                  return (
                    <tr 
                      key={session.id || session.session_key} 
                      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Started At */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {formatSingleLineDateTime(session.created_at)}
                        </span>
                      </td>

                      {/* End Time */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        {statusInfo.status === 'active' ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            Ongoing
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-neutral-400 font-medium">
                            {formatSingleLineDateTime(session.last_active_at)}
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-gray-500 dark:text-neutral-400 text-left">
                        {durationStr}
                      </td>

                      {/* Device */}
                      <td className="py-2.5 px-3 text-left">
                        <span className="font-semibold truncate text-[10px] block max-w-[150px]" title={session.device_name}>
                          {parseDeviceAndOS(session.device_name).device}
                        </span>
                      </td>

                      {/* Browser */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap">
                        <span className="text-gray-800 dark:text-neutral-300 font-medium truncate max-w-[100px] block" title={session.browser_name || 'Chrome'}>
                          {session.browser_name || 'Chrome'}
                        </span>
                      </td>

                      {/* Mode */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap">
                        {session.is_incognito ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                            Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* OS */}
                      <td className="py-2.5 px-3 text-left">
                        <span className="text-gray-500 dark:text-neutral-400 font-medium">
                          {parseDeviceAndOS(session.device_name).os}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        <button
                          onClick={() => setSelectedSessionForModal(session)}
                          className="font-mono text-[10px] text-gray-800 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400 font-bold hover:underline cursor-pointer max-w-[110px] truncate block bg-transparent border-0 p-0 text-left"
                          title={session.ip_address || '-'}
                        >
                          {session.ip_address || '-'}
                        </button>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-left">
                        <button
                          onClick={() => setSelectedSessionForModal(session)}
                          className="text-[10px] text-gray-800 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium hover:underline cursor-pointer max-w-[130px] sm:max-w-[150px] truncate block bg-transparent border-0 p-0 text-left"
                          title={session.location || 'Unknown Location'}
                        >
                          <span className="truncate">{session.location || 'Unknown Location'}</span>
                        </button>
                      </td>

                      {/* Last Battery Percentage */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left font-mono text-[10px]">
                        <span className="font-semibold text-[var(--profile-text-primary)]">
                          {session.battery_percentage !== undefined && session.battery_percentage !== null ? `${session.battery_percentage}%` : 'N/A'}
                        </span>
                      </td>

                      {/* Action By */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left font-mono text-[10px]">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {getSessionActions(session, userName, userEmail).actionBy}
                        </span>
                      </td>

                      {/* Action From */}
                      <td className="py-2.5 px-3 text-left font-mono text-[10px]">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 truncate block max-w-[150px]" title={getSessionActions(session, userName, userEmail).actionFrom}>
                          {getSessionActions(session, userName, userEmail).actionFrom}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        {statusInfo.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                            Active
                          </span>
                        )}
                        {statusInfo.status === 'logged_out' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                            Logged Out
                          </span>
                        )}
                        {statusInfo.status === 'terminated' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-wide">
                            Terminated
                          </span>
                        )}
                        {statusInfo.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                            Expired
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            Current
                          </span>
                        ) : isRowActionRunning === session.id ? (
                          <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-gray-400">
                            <span className="w-2.5 h-2.5 border border-gray-400/40 border-t-purple-500 rounded-full animate-spin inline-block"></span>
                            <span>{confirmingDeleteId === session.id ? 'Deleting...' : 'Terminating...'}</span>
                          </div>
                        ) : confirmingTerminateId === session.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                            <button
                              type="button"
                              onClick={() => setConfirmingTerminateId(null)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                            >
                              Cancel
                            </button>
                            <span className="text-gray-400 dark:text-neutral-600">|</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRowActionRunning(session.id);
                                try {
                                  if (onTerminateSession) {
                                    await onTerminateSession(session.id);
                                  }
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setIsRowActionRunning(null);
                                  setConfirmingTerminateId(null);
                                }
                              }}
                              className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                            >
                              Terminate
                            </button>
                          </div>
                        ) : confirmingDeleteId === session.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                            >
                              Cancel
                            </button>
                            <span className="text-gray-400 dark:text-neutral-600">|</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRowActionRunning(session.id);
                                try {
                                  if (onDeleteSession) {
                                    await onDeleteSession(session.id);
                                  }
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setIsRowActionRunning(null);
                                  setConfirmingDeleteId(null);
                                }
                              }}
                              className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                            >
                              Delete
                            </button>
                          </div>
                        ) : statusInfo.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingTerminateId(session.id);
                              setConfirmingDeleteId(null);
                            }}
                            className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                            title="Remotely terminate this active session"
                          >
                            Terminate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingDeleteId(session.id);
                              setConfirmingTerminateId(null);
                            }}
                            className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                            title="Delete session record"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 px-4 sm:px-6 md:px-8 -mx-4 sm:-mx-6 md:-mx-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] border-b border-gray-200 dark:border-white/10 bg-white/40 dark:bg-neutral-950/20 text-xs text-[var(--profile-text-muted)] font-mono space-y-4">
          
          {/* Top Pagination Navigation Row */}
          <div className="flex items-center justify-between w-full border-b border-gray-200/50 dark:border-white/5 pb-3">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 py-1 px-1 text-xs font-semibold text-[var(--profile-text-secondary)] hover:text-[var(--profile-text-primary)] hover:bg-[var(--profile-table-row-hover)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none bg-transparent border-0"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Page indicator in the center */}
            <span className="px-2 font-semibold text-[var(--profile-text-primary)] text-xs">
              Page {currentPage} / {totalPages}
            </span>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 py-1 px-1 text-xs font-semibold text-[var(--profile-text-secondary)] hover:text-[var(--profile-text-primary)] hover:bg-[var(--profile-table-row-hover)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none bg-transparent border-0"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Info & Rows Per Page Row */}
          <div className="flex flex-row items-center justify-between w-full gap-2 text-[11px]">
            {/* Showing details */}
            <div className="flex items-center gap-1 flex-wrap">
              <span>Showing</span>
              <span className="font-semibold text-[var(--profile-text-primary)]">
                {filteredSessions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              </span>
              <span>to</span>
              <span className="font-semibold text-[var(--profile-text-primary)]">
                {Math.min(currentPage * itemsPerPage, filteredSessions.length)}
              </span>
              <span>from</span>
              <span className="font-semibold text-[var(--profile-text-primary)]">
                {filteredSessions.length}
              </span>
              <span className="hidden sm:inline">records</span>
            </div>

            {/* Rows per page with Custom Selector Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span>Rows per page:</span>
              <div className="relative">
                <button
                  onClick={() => setIsRowsPerPageDropdownOpen(!isRowsPerPageDropdownOpen)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--profile-input-bg)] text-[var(--profile-input-text)] border border-[var(--profile-input-border)] hover:bg-[var(--profile-table-row-hover)] transition-colors flex items-center gap-1.5 cursor-pointer font-medium text-[11px]"
                >
                  <span>{itemsPerPage} rows</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {isRowsPerPageDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsRowsPerPageDropdownOpen(false)} />
                    <div className="absolute right-0 bottom-full mb-1.5 w-28 bg-[var(--profile-modal-bg)] border border-[var(--profile-card-border)] rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-1">
                      {[10, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setItemsPerPage(num);
                            setCurrentPage(1);
                            setIsRowsPerPageDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--profile-table-row-hover)] flex items-center justify-between transition-colors ${itemsPerPage === num ? 'text-[var(--profile-accent)] font-semibold' : 'text-[var(--profile-text-secondary)]'}`}
                        >
                          <span>{num} rows</span>
                          {itemsPerPage === num && <Check className="w-3.5 h-3.5 text-[var(--profile-accent)]" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: IP & Location Full Details */}
      {selectedSessionForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-md bg-[var(--profile-modal-bg)] border border-[var(--profile-modal-border)] rounded-2xl shadow-[var(--profile-modal-shadow)] overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--profile-card-border)] flex items-center justify-between bg-[var(--profile-card-subtle-bg)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--profile-accent)]" />
                <h3 className="text-sm font-bold text-[var(--profile-text-primary)]">
                  Session Node Telemetry Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="p-1 rounded-lg text-[var(--profile-text-muted)] hover:text-[var(--profile-text-primary)] hover:bg-[var(--profile-card-border)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Device & Client</span>
                <span className="text-sm font-semibold text-[var(--profile-text-primary)]">
                  {selectedSessionForModal.device_name || 'Generic Web Device'}
                </span>
                {(selectedSessionForModal.is_current || selectedSessionForModal.session_key === currentSessionKey) && (
                  <span className="text-[11px] text-indigo-500 font-semibold">Current Active Device</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Public IP Address</span>
                  <span className="font-mono text-xs font-semibold text-[var(--profile-text-primary)] select-all">
                    {selectedSessionForModal.ip_address || '127.0.0.1'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Status</span>
                  <span className="text-xs font-semibold text-[var(--profile-text-primary)]">
                    {getSessionStatus(selectedSessionForModal).label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Geo-Location Metadata</span>
                  <span className="text-xs font-medium text-[var(--profile-text-primary)] flex items-start gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{selectedSessionForModal.location || 'Unknown Location Coordinates'}</span>
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Battery</span>
                  <span className="font-mono text-xs font-semibold text-[var(--profile-text-primary)]">
                    {selectedSessionForModal.battery_percentage !== undefined && selectedSessionForModal.battery_percentage !== null ? `${selectedSessionForModal.battery_percentage}%` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Session Started</span>
                  <span className="text-xs font-medium text-[var(--profile-text-primary)]">
                    {formatDateTime(selectedSessionForModal.created_at).full}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Last Heartbeat</span>
                  <span className="text-xs font-medium text-[var(--profile-text-primary)]">
                    {formatDateTime(selectedSessionForModal.last_active_at).full}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Action By</span>
                  <span className="text-xs font-semibold text-[var(--profile-text-primary)]">
                    {getSessionActions(selectedSessionForModal, userName, userEmail).actionBy}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Action From</span>
                  <span className="text-xs font-semibold text-[var(--profile-text-primary)]">
                    {getSessionActions(selectedSessionForModal, userName, userEmail).actionFrom}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--profile-card-subtle-bg)] border border-[var(--profile-card-border)]">
                <span className="text-[10px] uppercase font-bold text-[var(--profile-text-muted)] tracking-wider">Unique Session Identifier</span>
                <span className="font-mono text-[11px] text-[var(--profile-text-muted)] break-all select-all">
                  {selectedSessionForModal.id || selectedSessionForModal.session_key}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--profile-card-border)] bg-[var(--profile-card-subtle-bg)] flex items-center justify-between">
              <button
                onClick={handleCopyModalDetails}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--profile-card-bg)] hover:bg-[var(--profile-card-border)] text-[var(--profile-text-primary)] border border-[var(--profile-card-border)] text-xs font-medium transition-colors"
              >
                {isCopiedDetails ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Audit</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[var(--profile-accent)] text-white hover:bg-[var(--profile-accent-hover)] text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.action}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmButtonText={confirmModalConfig.confirmText}
        confirmButtonVariant={confirmModalConfig.isDangerous ? 'danger' : 'primary'}
        isLoading={isBulkRunning}
        loadingText={confirmModalConfig.confirmText}
      />
      </div>
    </div>
  );
};
