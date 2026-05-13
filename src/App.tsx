import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc, setDoc, addDoc, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { Client, Command, Anamnesis, EvolutionEntry, Service } from './types';
import { 
  Users, 
  LayoutDashboard, 
  CreditCard, 
  Plus, 
  Search, 
  ChevronRight, 
  LogOut, 
  ClipboardList, 
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Trash2,
  Settings as SettingsIcon,
  Mail,
  Activity,
  Calendar,
  RotateCcw,
  Trash,
  Briefcase,
  UploadCloud,
  User as LucideUser,
  MessageCircle,
  ExternalLink,
  MapPin,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Input, Modal } from './components/ui';
import { 
  ClientForm, 
  AnamnesisForm, 
  CommandForm, 
  EvolutionForm, 
  ProfessionalForm, 
  ServiceRegistrationForm,
  ExcelImporter,
  AppointmentForm,
  LocationForm,
  ProfessionalTransactionForm
} from './components/Forms';
import { Professional, RegisteredService, Appointment, ClinicBranch, ProfessionalTransaction } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'finance' | 'settings' | 'trash' | 'services' | 'agenda' | 'birthdays' | 'professionals_history'>('dashboard');
  const [clientSection, setClientSection] = useState<'anamnesis' | 'evolution' | 'appointment' | 'command' | 'legacy'>('anamnesis');
  const [pendingCommandServices, setPendingCommandServices] = useState<Service[]>([]);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLimit, setClientsLimit] = useState(20);
  const [hasMoreClients, setHasMoreClients] = useState(true);
  
  const [commands, setCommands] = useState<Command[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLimit, setAppointmentsLimit] = useState(50);
  const [financeLimit, setFinanceLimit] = useState(20);
  const [clientFinanceLimit, setClientFinanceLimit] = useState(10);
  
  const [deletedAnamnesis, setDeletedAnamnesis] = useState<Anamnesis[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<RegisteredService[]>([]);
  const [locations, setLocations] = useState<ClinicBranch[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentInitialTime, setAppointmentInitialTime] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [professionalTransactions, setProfessionalTransactions] = useState<ProfessionalTransaction[]>([]);
  const [transactionModal, setTransactionModal] = useState<{ isOpen: boolean, type: 'payment' | 'advance', professionalId: string } | null>(null);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(clientsLimit));
    const unsubClients = onSnapshot(clientsQuery, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setHasMoreClients(snapshot.docs.length === clientsLimit);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const commandsQuery = query(collection(db, 'commands'), orderBy('date', 'desc'), limit(100));
    const unsubCommands = onSnapshot(commandsQuery, (snapshot) => {
      setCommands(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Command)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'commands'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    const deletedAnamnesisQuery = query(collection(db, 'anamnesis'), where('isDeleted', '==', true));
    const unsubDeletedAnamnesis = onSnapshot(deletedAnamnesisQuery, (snapshot) => {
      setDeletedAnamnesis(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Anamnesis)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'anamnesis'));

    const unsubProfessionals = onSnapshot(query(collection(db, 'professionals'), orderBy('name')), (snapshot) => {
      setProfessionals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Professional)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'professionals'));

    const unsubServicesCatalog = onSnapshot(query(collection(db, 'services_catalog'), orderBy('name')), (snapshot) => {
      setServicesCatalog(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredService)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'services_catalog'));

    const unsubLocations = onSnapshot(query(collection(db, 'locations'), orderBy('name')), (snapshot) => {
      setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClinicBranch)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));

    const unsubAppointments = onSnapshot(query(collection(db, 'appointments'), orderBy('date')), (snapshot) => {
      setAppointments(snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        date: d.data().date?.toDate(),
        endDate: d.data().endDate?.toDate()
      } as Appointment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    const unsubTransactions = onSnapshot(query(collection(db, 'professional_transactions'), orderBy('date', 'desc')), (snapshot) => {
      setProfessionalTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProfessionalTransaction)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'professional_transactions'));

    return () => {
      unsubClients();
      unsubCommands();
      unsubSettings();
      unsubDeletedAnamnesis();
      unsubProfessionals();
      unsubServicesCatalog();
      unsubLocations();
      unsubAppointments();
      unsubTransactions();
    };
  }, [user]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="w-20 h-20 bg-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
            <ClipboardList className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Raras Prime Care</h1>
          <p className="text-slate-500 mb-8">Gestão especializada para sua clínica de podologia.</p>
          <Button onClick={loginWithGoogle} className="w-full py-4 text-lg bg-teal-600 hover:bg-teal-700">
            Acessar com Google
          </Button>
          <p className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-semibold">
            Raras Prime Care - Sistema Gestor
          </p>
        </motion.div>
      </div>
    );
  }

  // Filtered Data
  const filteredClients = clients
    .filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone.includes(searchQuery)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const calculateCompanyProfit = (cmdList: Command[]) => {
    return cmdList.reduce((acc, c) => {
      const totalComm = c.services.reduce((sum, s) => sum + (s.commissionValue || 0), 0);
      return acc + (c.netTotal || c.total) - totalComm;
    }, 0);
  };

  const calculateGrossTotal = (cmdList: Command[]) => {
    return cmdList.reduce((acc, c) => acc + (c.total || 0), 0);
  };

  const openCommands = commands.filter(c => c.status === 'open');
  const paidCommands = commands.filter(c => c.status === 'paid');

  const updateCommandStatus = async (id: string, status: 'paid' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'commands', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `commands/${id}`);
    }
  };

  const saveSettings = async (newData: any) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { ...newData, updatedAt: new Date() });
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;
    try {
      console.log('Tentando excluir cliente:', id);
      await deleteDoc(doc(db, 'clients', id));
      
      // Cleanup associated appointments
      const clientApps = appointments.filter(a => a.clientId === id);
      console.log('Excluindo agendamentos associados:', clientApps.length);
      for (const app of clientApps) {
        await deleteDoc(doc(db, 'appointments', app.id));
      }

      // Cleanup anamnesis
      try {
        await deleteDoc(doc(db, 'anamnesis', id));
      } catch (e) {
        console.warn('Ficha de anamnese não encontrada ou erro ao excluir:', e);
      }

      setSelectedClient(null);
      alert('Cliente e dados associados excluídos com sucesso!');
    } catch (error) {
      console.error('Erro fatal ao excluir cliente:', error);
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    }
  };

  const deleteProfessional = async (id: string) => {
    if (!user?.emailVerified) {
      alert('Seu email não está verificado. Por favor, verifique-o para realizar exclusões.');
      return;
    }
    if (!confirm('Deseja realmente excluir este profissional?')) return;
    try {
      await deleteDoc(doc(db, 'professionals', id));
      alert('Profissional excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `professionals/${id}`);
    }
  };

  const deleteService = async (id: string) => {
    if (!user?.emailVerified) {
      alert('Seu email não está verificado. Por favor, verifique-o para realizar exclusões.');
      return;
    }
    if (!confirm('Deseja realmente excluir este serviço?')) return;
    try {
      await deleteDoc(doc(db, 'services_catalog', id));
      alert('Serviço excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services_catalog/${id}`);
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Deseja realmente excluir este local?')) return;
    try {
      console.log('Tentando excluir local:', id);
      await deleteDoc(doc(db, 'locations', id));
      alert('Local excluído com sucesso!');
    } catch (error) {
      console.error('Erro fatal ao excluir local:', error);
      handleFirestoreError(error, OperationType.DELETE, `locations/${id}`);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!user?.emailVerified) {
      alert('Seu email não está verificado. Por favor, verifique-o para realizar exclusões.');
      return;
    }
    if (!confirm('Deseja realmente excluir este agendamento?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      alert('Agendamento excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
    }
  };

  const syncToGoogleCalendar = async (a: Appointment) => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert('Atenção: Para exportar para o Google Agenda, é necessário sair e entrar novamente no sistema para conceder a permissão necessária.');
      return;
    }

    try {
      const startDate = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
      const endDate = a.endDate ? (a.endDate instanceof Date ? a.endDate : (a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate))) : new Date(startDate.getTime() + 60 * 60 * 1000);

      const event = {
        summary: `Raras Prime: ${a.serviceName} - ${a.clientName}`,
        location: 'Raras Prime Care',
        description: `Agendamento Raras Prime Care\n\nCliente: ${a.clientName}\nProfissional: ${a.professionalName}\nServiço: ${a.serviceName}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        alert('Agendamento exportado para o Google Agenda!');
      } else {
        const errorData = await response.json();
        if (errorData.error?.code === 401) {
          alert('Sua sessão do Google expirou. Por favor, saia e entre novamente.');
        } else if (errorData.error?.message?.includes('Google Calendar API has not been used')) {
          const apiLink = "https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=287583742337";
          if (confirm('A API do Google Agenda não está habilitada para este projeto. Deseja abrir o Console do Google Cloud para habilitá-la?')) {
            window.open(apiLink, '_blank');
          }
        } else {
          throw new Error(errorData.error?.message || 'Erro desconhecido ao exportar.');
        }
      }
    } catch (err) {
      console.error('Erro de Sincronização Google Calendar:', err);
      alert('Erro ao sincronizar: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const softDeleteAnamnesis = async (clientId: string) => {
    if (!confirm('Deseja enviar esta ficha para a lixeira?')) return;
    try {
      await updateDoc(doc(db, 'anamnesis', clientId), { 
        isDeleted: true, 
        deletedAt: new Date() 
      });
      alert('Ficha enviada para a lixeira.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `anamnesis/${clientId}`);
    }
  };

  const restoreAnamnesis = async (clientId: string) => {
    try {
      await updateDoc(doc(db, 'anamnesis', clientId), { 
        isDeleted: false,
        deletedAt: null
      });
      alert('Ficha restaurada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `anamnesis/${clientId}`);
    }
  };

  const permanentDeleteAnamnesis = async (clientId: string) => {
    if (!confirm('Deseja excluir permanentemente esta ficha? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteDoc(doc(db, 'anamnesis', clientId));
      alert('Ficha excluída permanentemente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `anamnesis/${clientId}`);
    }
  };

  const updateLegacyHistory = async (text: string) => {
    try {
      if (!selectedClient) return;
      await updateDoc(doc(db, 'clients', selectedClient.id), { legacyHistory: text });
      setSelectedClient({ ...selectedClient, legacyHistory: text });
      alert('Histórico legado atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${selectedClient?.id}`);
    }
  };

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const birthdayClientsToday = clients.filter(c => {
    if (!c.birthDate) return false;
    const parts = c.birthDate.split('-');
    if (parts.length < 3) return false;
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    return m === currentMonth && d === currentDay;
  });

  const birthdayClientsMonth = clients.filter(c => {
    if (!c.birthDate) return false;
    const parts = c.birthDate.split('-');
    if (parts.length < 3) return false;
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    return m === currentMonth && d !== currentDay;
  }).sort((a, b) => {
    const dayA = parseInt(a.birthDate.split('-')[2]);
    const dayB = parseInt(b.birthDate.split('-')[2]);
    return dayA - dayB;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav id="sidebar" className="w-full md:w-20 bg-slate-900 border-b md:border-b-0 p-4 flex md:flex-col items-center gap-6 z-10 sticky top-0 md:h-screen">
        <div className="hidden md:flex items-center justify-center w-12 h-12 bg-teal-500 rounded-xl mb-4">
          <span className="text-white font-bold text-lg">PC</span>
        </div>

        <button 
          onClick={() => { setActiveTab('dashboard'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'dashboard' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Dashboard"
        >
          <LayoutDashboard size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('clients'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'clients' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Clientes"
        >
          <Users size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('agenda'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'agenda' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Agenda"
        >
          <Calendar size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('finance'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'finance' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Financeiro"
        >
          <CreditCard size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('services'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'services' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Serviços e Profissionais"
        >
          <Briefcase size={24} />
        </button>

        <button 
          onClick={() => { setActiveTab('birthdays'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'birthdays' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Aniversariantes"
        >
          <LucideUser size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('professionals_history'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'professionals_history' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Histórico Profissional"
        >
          <Briefcase size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('settings'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'settings' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Configurações"
        >
          <SettingsIcon size={24} />
        </button>
        <button 
          onClick={() => { setActiveTab('trash'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center p-3 rounded-xl transition-all",
            activeTab === 'trash' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Lixeira"
        >
          <Trash size={24} />
        </button>

        <div className="mt-auto hidden md:flex flex-col items-center gap-6 p-2 pt-8">
          <button onClick={logout} className="flex items-center justify-center p-3 rounded-xl text-slate-500 hover:text-white transition-all">
            <LogOut size={24} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
        {user && !user.emailVerified && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 animate-in fade-in slide-in-from-top-2">
            <XCircle size={24} className="shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Email não verificado!</p>
              <p className="text-xs opacity-80">Por favor, verifique seu email para conseguir salvar dados no sistema. Verifique também sua caixa de spam.</p>
            </div>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => alert('Por favor, abra seu email e clique no link de verificação enviado pelo Google/Firebase.')}>
              <Mail size={14} className="mr-2" /> Como verificar?
            </Button>
          </div>
        )}
        <AnimatePresence mode="wait">
          {/* Dashboard View */}
          {activeTab === 'dashboard' && !selectedClient && !isAddingClient && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                  <p className="text-gray-500 mt-1">Bem-vindo de volta, {user.displayName?.split(' ')[0]}.</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p>
                  </div>
                  <Button size="sm" className="gap-2 bg-emerald-600" onClick={() => {
                    setActiveTab('clients');
                    alert('Selecione um cliente para abrir a comanda.');
                  }}>
                    <CreditCard size={14} /> Abrir Comanda
                  </Button>
                  <Button size="sm" className="gap-2 bg-teal-600" onClick={() => setActiveTab('agenda')}>
                    <Calendar size={14} /> Ver Agenda
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 flex flex-col justify-between h-32 border-l-4 border-l-teal-500">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agendamentos (Hoje)</span>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-bold font-mono text-slate-800">
                      {appointments.filter(a => {
                        const today = new Date();
                        const appDate = a.date;
                        return appDate && appDate.getDate() === today.getDate() && 
                               appDate.getMonth() === today.getMonth() && 
                               appDate.getFullYear() === today.getFullYear();
                      }).length}
                    </span>
                    <Calendar size={20} className="text-teal-500 mb-1" />
                  </div>
                </Card>
                <Card className="p-6 flex flex-col justify-between h-32 border-l-4 border-l-amber-500">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Clientes</span>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-bold font-mono text-slate-800">{clients.length}</span>
                    <Users size={20} className="text-amber-500 mb-1" />
                  </div>
                </Card>
                <Card className="p-6 flex flex-col justify-between h-32 border-l-4 border-l-teal-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receita (Aberto)</span>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold font-mono text-teal-700">{formatCurrency(openCommands.reduce((acc, c) => acc + c.total, 0))}</span>
                    <CreditCard size={20} className="text-teal-700 mb-1" />
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Próximos Agendamentos</h3>
                  <div className="space-y-3">
                    {appointments
                      .filter(a => a.status !== 'attended' && a.date >= new Date())
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .slice(0, 5)
                      .map(a => (
                        <Card key={a.id} className="p-4 flex items-center justify-between border-slate-100 hover:border-slate-200 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400">
                              <span className="text-[9px] font-bold uppercase">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(a.date)}</span>
                              <span className="text-xs font-bold">{a.date.getDate()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{a.clientName}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)} • {a.serviceName}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                syncToGoogleCalendar(a);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-teal-600"
                              title="Exportar para Google Agenda"
                            >
                              <Calendar size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAppointment(a.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    {appointments.filter(a => a.status !== 'attended' && a.date >= new Date()).length === 0 && (
                      <p className="text-sm text-slate-400 italic py-4">Nenhum agendamento futuro.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Comandas em Aberto</h3>
                  {openCommands.length === 0 ? (
                    <Card className="p-12 text-center h-full flex items-center justify-center">
                      <p className="text-gray-400">Nenhuma comanda aberta.</p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {openCommands.slice(0, 3).map(command => (
                        <Card key={command.id} className="p-6 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold">{command.clientName}</p>
                            <p className="text-xs text-gray-400">{formatDate(command.date?.toDate())}</p>
                          </div>
                          <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-[10px] font-bold uppercase tracking-wider">Aberto</span>
                        </div>
                        <div className="space-y-1">
                          {command.services.map((s, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-500">
                              <span>{s.name}</span>
                              <span>{formatCurrency(s.price)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                          <span className="text-sm font-bold">{formatCurrency(command.total)}</span>
                          <div className="flex gap-2">
                             <Button size="sm" variant="outline" className="text-green-600 border-green-100 hover:bg-green-50" onClick={() => updateCommandStatus(command.id, 'paid')}>
                               <CheckCircle2 size={14} className="mr-1.5" /> Pago
                             </Button>
                             <Button size="sm" variant="outline" className="text-red-500 border-red-100 hover:bg-red-50" onClick={() => updateCommandStatus(command.id, 'cancelled')}>
                               <XCircle size={14} />
                             </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

          {/* Clients View */}
          {activeTab === 'clients' && !selectedClient && !isAddingClient && (
            <motion.div 
              key="clients"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row gap-4 md:items-end justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
                  <p className="text-gray-500 mt-1">Gerencie a base de clientes da clínica.</p>
                </div>
                <Button onClick={() => setIsAddingClient(true)} className="gap-2">
                  <Plus size={18} /> Novo Cliente
                </Button>
              </header>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou telefone..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-300 outline-none transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map(client => (
                  <Card 
                    key={client.id} 
                    className="p-5 hover:border-gray-300 cursor-pointer transition-all active:scale-[0.99] group" 
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-500 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                        {client.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setSelectedClient(client)}>
                        <p className="font-bold truncate text-sm">{client.name}</p>
                        <p className="text-xs text-gray-400 font-mono tracking-tight">{client.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClient(client.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </Button>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {hasMoreClients && !searchQuery && (
                <div className="flex justify-center pt-8">
                  <Button 
                    variant="outline" 
                    onClick={() => setClientsLimit(prev => prev + 20)}
                    className="gap-2"
                  >
                    Carregar Mais Clientes
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Agenda View */}
          {activeTab === 'agenda' && (
            <motion.div 
              key="agenda"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-800">Agenda de Horários</h2>
                  <p className="text-slate-500">Acompanhe seus compromissos e agendamentos.</p>
                </div>
                <div className="flex gap-3">
                  <Input 
                    type="date" 
                    value={selectedAgendaDate} 
                    onChange={(e) => setSelectedAgendaDate(e.target.value)} 
                    className="max-w-[200px]"
                  />
                  <Button onClick={() => { setAppointmentInitialTime(''); setIsAppointmentModalOpen(true); }} className="gap-2">
                    <Plus size={18} /> Novo Agendamento
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Time Slots Grid */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                     <Clock className="text-teal-600" size={24} />
                     <h3 className="text-xl font-bold text-slate-800">
                       {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(selectedAgendaDate + 'T12:00:00'))}
                     </h3>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    {Array.from({ length: 13 }).map((_, i) => {
                      const hour = 8 + i;
                      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                      const hourAppointments = appointments.filter(a => {
                        const appDate = a.date;
                        if (!appDate) return false;
                        const sameDay = appDate.toISOString().split('T')[0] === selectedAgendaDate;
                        const sameHour = appDate.getHours() === hour;
                        return sameDay && sameHour;
                      });

                      return (
                        <div key={hour} className="group flex border-b border-slate-50 last:border-0 min-h-[80px]">
                          <div className="w-20 p-4 border-r border-slate-50 flex flex-col items-center justify-center bg-slate-50/30 group-hover:bg-slate-50 transition-colors">
                            <span className="text-sm font-bold text-slate-700 font-mono">{timeStr}</span>
                          </div>
                          <div className="flex-1 p-2 relative flex flex-wrap gap-2 items-start content-start">
                            {hourAppointments.length === 0 ? (
                              <button 
                                onClick={() => {
                                  setAppointmentInitialTime(timeStr);
                                  setIsAppointmentModalOpen(true);
                                }}
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-teal-400 font-bold text-xs uppercase tracking-widest gap-2"
                              >
                                <Plus size={14} /> Reservar Horário
                              </button>
                            ) : (
                              hourAppointments.map(a => {
                                const profColor = professionals.find(p => p.id === a.professionalId)?.color;
                                return (
                                  <div key={a.id} className={cn(
                                    "p-3 rounded-2xl flex flex-col gap-1 min-w-[200px] max-w-[300px] border-l-[6px] transition-all cursor-pointer shadow-sm",
                                    a.status === 'attended'
                                      ? "bg-slate-50 border-slate-200 text-slate-400 opacity-60 shadow-none cursor-default"
                                      : ""
                                  )}
                                  style={a.status !== 'attended' ? {
                                    backgroundColor: profColor ? `${profColor}10` : (a.status === 'confirmed' ? '#f0fdfa' : '#fffbeb'),
                                    borderColor: profColor || (a.status === 'confirmed' ? '#ccfbf1' : '#fef3c7'),
                                    color: profColor || (a.status === 'confirmed' ? '#0f766e' : '#b45309')
                                  } : {}}
                                onClick={() => {
                                  if (a.status === 'attended') return;
                                  const client = clients.find(c => c.id === a.clientId);
                                  if (client) {
                                    setSelectedClient(client);
                                    setClientSection('appointment');
                                    setActiveTab('clients');
                                  }
                                }}>
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold text-xs truncate whitespace-nowrap">{a.clientName}</p>
                                    <span className="text-[10px] opacity-70 font-mono">
                                      {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}
                                      {a.endDate && ` - ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.endDate)}`}
                                    </span>
                                  </div>
                                  <p className="text-[10px] opacity-80 uppercase tracking-tighter truncate">
                                    {a.serviceName || 'Sem serviço'}
                                  </p>
                                  <div className="flex justify-between items-end mt-1">
                                    <span className="text-[9px] font-bold opacity-60">
                                      {a.professionalName || '-'}
                                    </span>
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const msg = `Olá ${a.clientName.split(' ')[0]}, Podemos Confirmar seu horário ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date)}, as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}h.?`;
                                            window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                          }}
                                          className="p-1 hover:bg-white/50 rounded-full transition-colors text-emerald-600"
                                          title="Confirmar Horário"
                                        >
                                          <MessageCircle size={14} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const dateStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date);
                                            const timeStr = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date);
                                            const msg = `Seu horário foi agendado com sucesso para Dia *${dateStr} as ${timeStr}h*\n\n🔴Tempo de tolerância para atraso é de *5 minutos.* Após faremos um novo agendamento, \n\n🔴*Em caso de desistência ou troca de horário por gentileza avisar com 4 horas de antecedência.*\n\n💰Forma de pagamentos:credito, débito Pix. No ato do check in.\n\n🔴*Evite Trazer Acompanhantes.*\n\nSiga nosso Instagram e fique por dentro das novidades 👇🏻\n\nhttps://www.instagram.com/podologaandressakupferman/\n\n*Por favor leia as regras da empresa,para não haver constrangimentos* 👆🏻`;
                                            window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                          }}
                                          className="p-1 hover:bg-white/50 rounded-full transition-colors text-teal-600"
                                          title="Enviar Regras de Agendamento"
                                        >
                                          <ExternalLink size={14} />
                                        </button>
                                        {a.status !== 'attended' && (
                                          <>
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const newStatus = a.status === 'confirmed' ? 'scheduled' : 'confirmed';
                                              try {
                                                await updateDoc(doc(db, 'appointments', a.id), { status: newStatus });
                                              } catch (err) {
                                                handleFirestoreError(err, OperationType.UPDATE, `appointments/${a.id}`);
                                              }
                                            }}
                                            className="p-1 hover:bg-white/50 rounded-full transition-colors"
                                          >
                                            <CheckCircle2 size={14} />
                                          </button>
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const client = clients.find(c => c.id === a.clientId);
                                              if (!client) return;
                                              
                                              // Pre-fill the services for the command calculator
                                              setPendingCommandServices([{
                                                name: a.serviceName || 'Procedimento',
                                                price: a.price || 0,
                                                professionalId: a.professionalId,
                                                professionalName: a.professionalName
                                              }]);
                                              
                                              // Redirect to command section
                                              setSelectedClient(client);
                                              setClientSection('command');
                                              setActiveTab('clients');
                                            }}
                                            className="p-1 hover:bg-white/50 rounded-full transition-colors text-emerald-600"
                                            title="Abrir Comanda / Calcular"
                                          >
                                            <CreditCard size={14} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              syncToGoogleCalendar(a);
                                            }}
                                            className="p-1 hover:bg-white/50 rounded-full transition-colors text-slate-400 hover:text-teal-600"
                                            title="Exportar para Google Agenda"
                                          >
                                            <Calendar size={14} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deleteAppointment(a.id);
                                            }}
                                            className="p-1 hover:bg-white/50 rounded-full transition-colors text-slate-300 hover:text-red-500"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Any Time / Custom View (for other times) */}
                  <div className="pt-8 space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">Outros Horários / Exceções</h3>
                    <div className="space-y-4">
                      {appointments.filter(a => {
                        const appDate = a.date;
                        if (!appDate) return false;
                        const sameDay = appDate.toISOString().split('T')[0] === selectedAgendaDate;
                        const hour = appDate.getHours();
                        return sameDay && (hour < 8 || hour > 20);
                      }).map(a => (
                        <Card key={a.id} className="p-4 flex items-center justify-between border-slate-100 italic text-slate-500">
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                              {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}
                              {a.endDate && ` - ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.endDate)}`}
                            </span>
                            <span className="text-sm font-bold text-slate-700">{a.clientName}</span>
                            <span className="text-xs">{a.serviceName}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => deleteAppointment(a.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Legend / Info */}
                  <Card className="p-6 space-y-4 bg-slate-900 text-white border-0 shadow-lg shadow-slate-900/10">
                    <h4 className="font-bold text-sm uppercase tracking-widest text-teal-400">Resumo do Dia</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Total</span>
                        <span className="font-bold">{appointments.filter(a => a.date?.toISOString().split('T')[0] === selectedAgendaDate).length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Confirmados</span>
                        <span className="font-bold text-teal-400">
                          {appointments.filter(a => a.date?.toISOString().split('T')[0] === selectedAgendaDate && a.status === 'confirmed').length}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Future Peek */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Próximos Dias</h3>
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1 + i);
                        const dStr = d.toISOString().split('T')[0];
                        const count = appointments.filter(a => a.date?.toISOString().split('T')[0] === dStr).length;

                        return (
                          <div 
                            key={i} 
                            onClick={() => setSelectedAgendaDate(dStr)}
                            className={cn(
                              "p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center",
                              selectedAgendaDate === dStr ? "bg-white border-teal-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                            )}
                          >
                             <div>
                               <p className="text-xs font-bold text-slate-400 uppercase">{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d)}</p>
                               <p className="font-bold text-slate-700">{d.getDate()} de {new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d)}</p>
                             </div>
                             <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
                               {count}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Services View */}
          
          {activeTab === 'services' && (
            <motion.div 
              key="services"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-12"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-800">Serviços e Profissionais</h2>
                  <p className="text-slate-500">Gerencie seu catálogo de procedimentos e equipe.</p>
                </div>
              </header>

              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <UploadCloud size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Importação de Backup (XLSX)</h3>
                </div>
                <ExcelImporter onImported={() => {}} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Professionals Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Profissionais</h3>
                  </div>
                  
                  <Card className="p-6 border-slate-100">
                    <ProfessionalForm onSuccess={() => alert('Profissional cadastrado!')} />
                  </Card>

                  <div className="space-y-3">
                    {professionals.length === 0 ? (
                      <p className="text-sm text-slate-400 italic text-center py-8">Nenhum profissional cadastrado.</p>
                    ) : (
                      professionals.map(pro => (
                        <Card key={pro.id} className="p-4 flex items-center justify-between border-slate-100 bg-slate-50/30">
                          <div>
                            <p className="font-bold text-slate-700">{pro.name}</p>
                            <p className="text-xs text-teal-600 font-bold uppercase tracking-wider">Comissão: {pro.defaultCommission}%</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => deleteProfessional(pro.id)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={16} />
                          </Button>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Services Catalog Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                      <ClipboardList size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Catálogo de Serviços</h3>
                  </div>
                  
                  <Card className="p-6 border-slate-100">
                    <ServiceRegistrationForm onSuccess={() => alert('Serviço adicionado ao catálogo!')} />
                  </Card>

                  <div className="space-y-6">
                    {servicesCatalog.length === 0 ? (
                      <p className="text-sm text-slate-400 italic text-center py-8">Nenhum serviço no catálogo.</p>
                    ) : (
                      ['Podologia', 'Manicure e Pedicure', 'Sobrancelhas', 'Depilação', 'Cílios', 'Outros'].map(category => {
                        const categoryServices = servicesCatalog.filter(s => {
                          const cat = s.category || 'Outros';
                          return cat === category || (category === 'Manicure e Pedicure' && cat === 'Manicure/Pedicure');
                        });
                        
                        if (categoryServices.length === 0) return null;

                        return (
                          <div key={category} className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{category}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {categoryServices.map(serv => (
                                <Card key={serv.id} className="p-4 flex items-center justify-between border-slate-100 bg-slate-50/30 group">
                                  <div className="flex-1">
                                    <p className="font-bold text-slate-700">{serv.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <input 
                                        type="number"
                                        step="0.01"
                                        defaultValue={serv.defaultPrice}
                                        onBlur={async (e) => {
                                          const newPrice = parseFloat(e.target.value);
                                          if (isNaN(newPrice) || newPrice === serv.defaultPrice) return;
                                          try {
                                            await updateDoc(doc(db, 'services_catalog', serv.id), { defaultPrice: newPrice });
                                          } catch (err) {
                                            handleFirestoreError(err, OperationType.UPDATE, `services_catalog/${serv.id}`);
                                          }
                                        }}
                                        className="text-xs text-teal-600 font-mono bg-transparent border-b border-transparent hover:border-teal-200 focus:border-teal-500 outline-none w-20 transition-colors"
                                      />
                                      <span className="text-[10px] text-slate-400 italic">(clique para editar preço)</span>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => deleteService(serv.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={16} />
                                  </Button>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
            )}

            {/* Finance View */}
        {/* Finance View */}
        {activeTab === 'finance' && (
          <motion.div 
            key="finance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Painel Financeiro</h2>
                <p className="text-gray-500 mt-1">Visão consolidada da saúde financeira da clínica.</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button className="px-4 py-2 text-xs font-bold rounded-lg bg-white text-teal-600 shadow-sm">Geral</button>
                 <button className="px-4 py-2 text-xs font-bold text-slate-500 rounded-lg hover:bg-white/50">Fluxo de Caixa</button>
              </div>
            </header>

            {/* Top Analysis Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-teal-600 text-white border-none shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <DollarSign size={80} />
                </div>
                <span className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">Faturamento Bruto (Mês)</span>
                <div className="mt-2">
                  <p className="text-3xl font-bold font-mono">
                    {formatCurrency(
                      paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                        })
                        .reduce((acc, c) => acc + (c.total || 0), 0)
                    )}
                  </p>
                  <p className="text-xs text-teal-100 mt-1 font-medium">Soma de todas as comandas pagas</p>
                </div>
              </Card>

              <Card className="p-6 bg-slate-900 text-white border-none shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Activity size={80} />
                </div>
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Lucro Empresa (Líquido Mês)</span>
                <div className="mt-2">
                  <p className="text-3xl font-bold text-white font-mono">
                    {formatCurrency(
                      paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                        })
                        .reduce((acc, c) => {
                          const totalComm = c.services.reduce((sum, s) => sum + (s.commissionValue || 0), 0);
                          return acc + (c.netTotal || c.total) - totalComm;
                        }, 0)
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Pós comissões e taxas</p>
                </div>
              </Card>

              <Card className="p-6 bg-white border-slate-100 shadow-xl relative overflow-hidden group">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Diário (Empresa)</span>
                <div className="mt-2">
                  <p className="text-3xl font-bold text-slate-900 font-mono">
                    {formatCurrency(
                      paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return date?.toDateString() === now.toDateString();
                        })
                        .reduce((acc, c) => {
                          const totalComm = c.services.reduce((sum, s) => sum + (s.commissionValue || 0), 0);
                          return acc + (c.netTotal || c.total) - totalComm;
                        }, 0)
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Apenas atendimentos de hoje</p>
                </div>
              </Card>

              <Card className="p-6 bg-white border-slate-100 shadow-xl relative overflow-hidden group">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comparativo Mensal</span>
                <div className="mt-2">
                  {(() => {
                    const now = new Date();
                    const currentMonth = paidCommands
                      .filter(c => {
                        const date = c.date?.toDate ? c.date.toDate() : new Date();
                        return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                      })
                      .reduce((acc, c) => acc + (c.total || 0), 0);
                    
                    const lastMonthDate = new Date();
                    lastMonthDate.setMonth(now.getMonth() - 1);
                    const lastMonth = paidCommands
                      .filter(c => {
                        const date = c.date?.toDate ? c.date.toDate() : new Date();
                        return date?.getMonth() === lastMonthDate.getMonth() && date?.getFullYear() === lastMonthDate.getFullYear();
                      })
                      .reduce((acc, c) => acc + (c.total || 0), 0);

                    const diff = currentMonth - lastMonth;
                    const percent = lastMonth > 0 ? (diff / lastMonth) * 100 : 0;

                    return (
                      <>
                        <div className="flex items-baseline gap-2">
                          <p className={cn("text-2xl font-bold font-mono", diff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                          </p>
                        </div>
                        <p className={cn("text-xs font-bold mt-1 uppercase", diff >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {diff >= 0 ? 'Melhor' : 'Menor'} que mês anterior ({percent.toFixed(1)}%)
                        </p>
                      </>
                    );
                  })()}
                </div>
              </Card>
            </div>

            {/* Bottom: Daily Lists and Reports */}
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> Atendimentos do Dia
                  </h3>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    {paidCommands.filter(c => {
                      const date = c.date?.toDate ? c.date.toDate() : new Date();
                      return date.toDateString() === new Date().toDateString();
                    }).map(c => (
                      <div key={c.id} className="p-4 border-b border-slate-50 last:border-none flex items-center justify-between group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                            {c.clientName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{c.clientName}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{c.paymentMethod}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(c.total)}</p>
                          <p className="text-[9px] text-teal-600 font-bold uppercase">Empresa: {formatCurrency((c.netTotal || c.total) - c.services.reduce((acc, s) => acc + (s.commissionValue || 0), 0))}</p>
                        </div>
                      </div>
                    ))}
                    {paidCommands.filter(c => {
                      const date = c.date?.toDate ? c.date.toDate() : new Date();
                      return date.toDateString() === new Date().toDateString();
                    }).length === 0 && (
                       <div className="p-12 text-center text-slate-300 text-xs font-medium italic">
                          Nenhum recebimento hoje.
                       </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={14} /> Rentabilidade por Modo
                  </h3>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    {['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito'].map(method => {
                      const methodTotal = paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return c.paymentMethod === method && date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                        })
                        .reduce((acc, c) => acc + (c.total || 0), 0);
                      
                      const grandTotal = paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                        })
                        .reduce((acc, c) => acc + (c.total || 0), 0);

                      const progress = grandTotal > 0 ? (methodTotal / grandTotal) * 100 : 0;

                      return (
                        <div key={method} className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-600">{method}</span>
                            <span className="font-mono font-bold text-slate-400">{formatCurrency(methodTotal)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className={cn(
                                "h-full rounded-full",
                                method === 'Pix' ? "bg-teal-500" :
                                method === 'Dinheiro' ? "bg-emerald-500" :
                                method === 'Cartão de Crédito' ? "bg-indigo-500" : "bg-blue-500"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Detailed Performance Comparison */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 size={14} /> Comparativo de Lucro Líquido Diário (Empresa)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  {[...Array(7)].map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    const dayLabel = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                    const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    const dayProfit = calculateCompanyProfit(paidCommands.filter(c => {
                      const cmdDate = c.date?.toDate ? c.date.toDate() : new Date();
                      return cmdDate.toDateString() === d.toDateString();
                    }));
                    
                    const isToday = d.toDateString() === new Date().toDateString();

                    return (
                      <Card key={i} className={cn(
                        "p-4 border-slate-100 flex flex-col items-center justify-center transition-all",
                        isToday ? "bg-teal-50 border-teal-200 shadow-md ring-2 ring-teal-500/10 scale-105 z-10" : "bg-white hover:border-slate-300"
                      )}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{dayLabel}</p>
                        <p className="text-[10px] font-bold text-slate-500 mb-2">{dateLabel}</p>
                        <p className={cn("text-xs font-black font-mono", dayProfit > 0 ? "text-teal-600" : "text-slate-300")}>
                          {formatCurrency(dayProfit)}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                  <div className="space-y-1">
                    <h4 className="text-teal-400 font-bold text-xs uppercase tracking-[0.2em]">Metas e Desempenho</h4>
                    <p className="text-white text-xl font-bold">Resumo Estratégico Mensal</p>
                    <p className="text-slate-400 text-xs">Comparativo de performance entre meses.</p>
                  </div>
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                      <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Mês Atual (Líquido)</p>
                      <p className="text-white text-xl font-mono font-bold">
                        {(() => {
                           const now = new Date();
                           return formatCurrency(calculateCompanyProfit(paidCommands.filter(c => {
                             const d = c.date?.toDate ? c.date.toDate() : new Date();
                             return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                           })));
                        })()}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                      <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Mês Anterior (Líquido)</p>
                      <p className="text-slate-500 text-xl font-mono font-bold">
                        {(() => {
                           const d = new Date();
                           d.setMonth(d.getMonth() - 1);
                           return formatCurrency(calculateCompanyProfit(paidCommands.filter(c => {
                             const cmdDate = c.date?.toDate ? c.date.toDate() : new Date();
                             return cmdDate.getMonth() === d.getMonth() && cmdDate.getFullYear() === d.getFullYear();
                           })));
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Professional History View */}
        {activeTab === 'professionals_history' && (
          <motion.div 
            key="professionals_history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <header>
              <h2 className="text-3xl font-bold tracking-tight">Histórico Profissional</h2>
              <p className="text-gray-500 mt-1">Acompanhamento de atendimentos e comissões por profissional.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Sidebar: Pro List */}
              <div className="md:col-span-1 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Selecione o Profissional</h3>
                <div className="space-y-2">
                  {professionals.map(pro => (
                    <button
                      key={pro.id}
                      onClick={() => setSelectedProfessionalId(pro.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border text-left transition-all",
                        selectedProfessionalId === pro.id 
                          ? "bg-white border-teal-200 shadow-sm" 
                          : "bg-white border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-400 bg-slate-50" style={selectedProfessionalId === pro.id ? { backgroundColor: pro.color, color: '#fff' } : {}}>
                          {pro.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-700">{pro.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">{pro.defaultCommission}% Comissão</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main: History and Commissions */}
              <div className="md:col-span-3 space-y-8">
                {selectedProfessionalId ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="p-6 bg-slate-900 border-none shadow-xl">
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Total de Atendimentos</span>
                        <div className="flex justify-between items-end mt-2">
                           <p className="text-3xl font-bold text-white font-mono">
                             {commands.filter(c => c.services.some(s => s.professionalId === selectedProfessionalId)).length}
                           </p>
                           <Users size={20} className="text-teal-400 mb-1" />
                        </div>
                      </Card>
                      <Card className="p-6 bg-teal-600 border-none shadow-xl">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Saldo Comissões (Pagas)</span>
                        <div className="flex justify-between items-end mt-2">
                           <p className="text-3xl font-bold text-white font-mono">
                             {formatCurrency(
                               (() => {
                                 const totalComm = commands
                                   .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === selectedProfessionalId))
                                   .reduce((acc, c) => acc + c.services
                                     .filter(s => s.professionalId === selectedProfessionalId)
                                     .reduce((sum, s) => sum + (s.commissionValue || 0), 0), 0
                                   );
                                 const paidTransactions = professionalTransactions
                                   .filter(t => t.professionalId === selectedProfessionalId && t.type === 'payment')
                                   .reduce((acc, t) => acc + t.amount, 0);
                                 const advances = professionalTransactions
                                   .filter(t => t.professionalId === selectedProfessionalId && t.type === 'advance')
                                   .reduce((acc, t) => acc + t.amount, 0);
                                 return totalComm - paidTransactions - advances;
                               })()
                             )}
                           </p>
                           <DollarSign size={20} className="text-white mb-1" />
                        </div>
                      </Card>
                      <Card className="p-6 bg-orange-600 border-none shadow-xl">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Vales em Aberto</span>
                        <div className="flex justify-between items-end mt-2">
                           <p className="text-3xl font-bold text-white font-mono">
                             {formatCurrency(
                               professionalTransactions
                                 .filter(t => t.professionalId === selectedProfessionalId && t.type === 'advance')
                                 .reduce((acc, t) => acc + t.amount, 0)
                             )}
                           </p>
                           <RotateCcw size={20} className="text-white mb-1" />
                        </div>
                      </Card>
                      <Card className="p-4 bg-white border-slate-100 flex flex-col justify-center gap-2">
                        <Button 
                          onClick={() => setTransactionModal({ isOpen: true, type: 'advance', professionalId: selectedProfessionalId! })}
                          variant="outline" 
                          className="w-full text-xs font-bold py-2 h-auto text-orange-600 border-orange-100 hover:bg-orange-50"
                        >
                          Fazer Vale
                        </Button>
                        <Button 
                          onClick={() => setTransactionModal({ isOpen: true, type: 'payment', professionalId: selectedProfessionalId! })}
                          className="w-full text-xs font-bold py-2 h-auto bg-emerald-600 hover:bg-emerald-700"
                        >
                          Fechar Pagamento
                        </Button>
                      </Card>
                    </div>

                    {/* Transaction History */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold">Pagamentos e Vales</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {professionalTransactions
                          .filter(t => t.professionalId === selectedProfessionalId)
                          .map(t => (
                            <div key={t.id} className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  t.type === 'advance' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {t.type === 'advance' ? <RotateCcw size={16} /> : <DollarSign size={16} />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{t.type === 'advance' ? 'Vale' : 'Pagamento Efetuado'}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{formatDate(t.date?.toDate())}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-sm font-bold font-mono", t.type === 'advance' ? "text-orange-600" : "text-emerald-600")}>
                                  {t.type === 'advance' ? '-' : ''}{formatCurrency(t.amount)}
                                </p>
                                <div className="flex gap-2 justify-end mt-1">
                                  {t.notes && <p className="text-[9px] text-slate-400 italic max-w-[100px] truncate">{t.notes}</p>}
                                  <button 
                                    onClick={async () => {
                                      if (confirm('Excluir este registro financeiro?')) {
                                        try { await deleteDoc(doc(db, 'professional_transactions', t.id)); }
                                        catch (err) { handleFirestoreError(err, OperationType.DELETE, `professional_transactions/${t.id}`); }
                                      }
                                    }}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        {professionalTransactions.filter(t => t.professionalId === selectedProfessionalId).length === 0 && (
                          <div className="col-span-full p-4 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl italic">
                            Nenhuma transação financeira registrada.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed History */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold">Histórico de Atendimentos</h3>
                      <div className="space-y-3">
                        {commands
                          .filter(c => c.services.some(s => s.professionalId === selectedProfessionalId))
                          .sort((a, b) => (b.date?.toDate?.()?.getTime() || 0) - (a.date?.toDate?.()?.getTime() || 0))
                          .map(command => {
                            const proServices = command.services.filter(s => s.professionalId === selectedProfessionalId);
                            const totalCommission = proServices.reduce((sum, s) => sum + (s.commissionValue || 0), 0);

                            return (
                              <Card key={command.id} className="p-5 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800">{command.clientName}</p>
                                    <span className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                                      command.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                    )}>
                                      {command.status === 'paid' ? 'Pago' : 'Pendente'}
                                    </span>
                                  </div>
                                  <div className="flex gap-4 text-xs text-slate-400 font-medium">
                                    <span>{formatDate(command.date?.toDate())}</span>
                                    <span>•</span>
                                    <span>{proServices.map(s => s.name).join(', ')}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 text-right">
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vlr. Procedimento</p>
                                    <p className="font-bold text-slate-700">{formatCurrency(proServices.reduce((sum, s) => sum + s.price, 0))}</p>
                                  </div>
                                  <div className="border-l border-slate-100 pl-6">
                                    <p className="text-[10px] font-bold text-teal-600 uppercase">Sua Comissão</p>
                                    <p className="font-bold text-teal-600 font-mono italic">{formatCurrency(totalCommission)}</p>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => setEditingCommand(command)} className="text-slate-300 hover:text-teal-600">
                                    <RotateCcw size={14} className="mr-1.5" /> Editar
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        {commands.filter(c => c.services.some(s => s.professionalId === selectedProfessionalId)).length === 0 && (
                          <div className="p-20 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl">
                             <Briefcase size={40} strokeWidth={1.5} />
                             <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Nenhum atendimento realizado ainda</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-4 bg-slate-50/30 rounded-3xl border border-slate-100">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-2">
                       <Briefcase size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Seleção de Profissional</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">Selecione um profissional na lista lateral para visualizar seu histórico e comissões.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Settings View */}
              {activeTab === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
                <p className="text-gray-500 mt-1">Personalize as preferências do seu sistema.</p>
              </header>

              <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <Mail className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Email de Backup</h3>
                    </div>
                    <p className="text-sm text-slate-500">
                      Sempre que uma nova ficha de anamnese for salva, uma cópia completa será enviada para este email pessoal.
                    </p>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      saveSettings({ ...settings, backupEmail: formData.get('backupEmail') });
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seu Email Pessoal</label>
                        <Input 
                          name="backupEmail" 
                          type="email" 
                          defaultValue={settings?.backupEmail || ''} 
                          placeholder="exemplo@email.com" 
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Email
                      </Button>
                    </form>
                  </Card>

                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <CreditCard className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Taxa - Débito</h3>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const fees = { ...settings?.fees };
                      fees.debit = parseFloat(formData.get('debit') as string);
                      saveSettings({ ...settings, fees });
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Porcentagem (%)</label>
                        <Input 
                          name="debit" 
                          type="number" 
                          step="0.01"
                          defaultValue={settings?.fees?.debit || 0} 
                          placeholder="Ex: 1.99" 
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Taxa Débito
                      </Button>
                    </form>
                  </Card>

                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <MapPin className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Unidades / Localizações</h3>
                    </div>
                    <LocationForm onSuccess={() => alert('Localização cadastrada!')} />
                    
                    <div className="space-y-3 mt-6">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unidades Cadastradas</label>
                      {locations.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Nenhuma unidade cadastrada.</p>
                      ) : (
                        <div className="space-y-2">
                          {locations.map(loc => (
                            <div key={loc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="font-bold text-slate-700 text-sm">{loc.name}</p>
                                {loc.address && <p className="text-xs text-slate-500">{loc.address}</p>}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => deleteLocation(loc.id)} className="text-slate-300 hover:text-red-500 p-1 h-8 w-8">
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="space-y-8">
                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <CreditCard className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Taxas - Visa / Mastercard (1x a 10x)</h3>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const fees = { ...settings?.fees };
                      fees.creditVisaMaster = Array.from({ length: 10 }, (_, i) => parseFloat(formData.get(`visa_${i+1}`) as string) || 0);
                      saveSettings({ ...settings, fees });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{i + 1}x (%)</label>
                            <Input 
                              name={`visa_${i+1}`} 
                              type="number" 
                              step="0.01"
                              defaultValue={settings?.fees?.creditVisaMaster?.[i] || 0} 
                              placeholder="0.00" 
                            />
                          </div>
                        ))}
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Taxas Visa/Master
                      </Button>
                    </form>
                  </Card>

                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <CreditCard className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Taxas - Elo / Amex (1x a 10x)</h3>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const fees = { ...settings?.fees };
                      fees.creditEloAmex = Array.from({ length: 10 }, (_, i) => parseFloat(formData.get(`elo_${i+1}`) as string) || 0);
                      saveSettings({ ...settings, fees });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{i + 1}x (%)</label>
                            <Input 
                              name={`elo_${i+1}`} 
                              type="number" 
                              step="0.01"
                              defaultValue={settings?.fees?.creditEloAmex?.[i] || 0} 
                              placeholder="0.00" 
                            />
                          </div>
                        ))}
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Taxas Elo/Amex
                      </Button>
                    </form>
                  </Card>

                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <Mail className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Taxas - Link de Pagamento (1x a 10x)</h3>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const fees = { ...settings?.fees };
                      fees.paymentLink = Array.from({ length: 10 }, (_, i) => parseFloat(formData.get(`link_${i+1}`) as string) || 0);
                      saveSettings({ ...settings, fees });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{i + 1}x (%)</label>
                            <Input 
                              name={`link_${i+1}`} 
                              type="number" 
                              step="0.01"
                              defaultValue={settings?.fees?.paymentLink?.[i] || 0} 
                              placeholder="0.00" 
                            />
                          </div>
                        ))}
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Taxas Link
                      </Button>
                    </form>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'birthdays' && (
          <motion.div 
            key="birthdays"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <header>
              <h2 className="text-3xl font-bold tracking-tight">Aniversariantes</h2>
              <p className="text-gray-500 mt-1">Celebre com seus clientes e ofereça mimos especiais.</p>
            </header>

            {birthdayClientsToday.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-rose-500">
                  <LucideUser size={20} /> Hoje ({birthdayClientsToday.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {birthdayClientsToday.map(client => (
                    <Card key={client.id} className="p-6 border-rose-100 bg-rose-50/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <LucideUser size={80} className="text-rose-500" />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="font-bold text-lg text-slate-800">{client.name}</p>
                          <p className="text-xs text-rose-400 font-bold uppercase">Faz anos hoje!</p>
                        </div>
                        <Button 
                          onClick={() => {
                            const msg = `Olá ${client.name.split(' ')[0]}, já estamos em clima de festa! No mês do seu aniversário você tem 10% de desconto em qualquer procedimento na Raras Clinic!`;
                            window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          className="w-full bg-rose-500 hover:bg-rose-600 gap-2"
                        >
                          <MessageCircle size={16} /> Enviar Parabéns (10% OFF)
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest px-1">Restante do Mês</h3>
              {birthdayClientsMonth.length === 0 && birthdayClientsToday.length === 0 ? (
                <Card className="p-20 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200">
                  <Calendar size={48} strokeWidth={1} />
                  <p className="font-bold uppercase tracking-widest text-xs">Nenhum aniversariante neste mês</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {birthdayClientsMonth.map(client => (
                    <Card key={client.id} className="p-5 hover:border-teal-200 transition-all cursor-pointer group" onClick={() => setSelectedClient(client)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 font-bold group-hover:bg-teal-500 group-hover:text-white transition-colors">
                          <span className="text-[10px] uppercase">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(client.birthDate + 'T12:00:00'))}</span>
                          <span className="text-sm">{client.birthDate.split('-')[2]}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-slate-700">{client.name}</p>
                          <p className="text-xs text-slate-400">{client.phone}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = `Olá ${client.name.split(' ')[0]}, já estamos em clima de festa! No mês do seu aniversário você tem 10% de desconto em qualquer procedimento na Raras Clinic!`;
                            window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          className="text-teal-600 hover:bg-teal-50"
                        >
                          <MessageCircle size={18} />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Trash View */}
          {activeTab === 'trash' && (
            <motion.div 
              key="trash"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Lixeira</h2>
                <p className="text-gray-500 mt-1">Fichas de anamnese excluídas recentemente.</p>
              </header>

              <div className="space-y-4">
                {deletedAnamnesis.length === 0 ? (
                  <Card className="p-20 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200">
                    <Trash size={48} strokeWidth={1} />
                    <p className="font-bold uppercase tracking-widest text-xs">A lixeira está vazia</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {deletedAnamnesis.map(anam => {
                      const client = clients.find(c => c.id === anam.id);
                      return (
                        <Card key={anam.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400">
                              <FileText size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">
                                Ficha de {client?.name || 'Cliente Removido'}
                              </p>
                              <p className="text-xs text-slate-400">
                                Excluída em: {formatDate(anam.deletedAt?.toDate()) || 'Data desconhecida'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => restoreAnamnesis(anam.id)}
                              className="gap-2 text-teal-600 border-teal-100 hover:bg-teal-50"
                            >
                              <RotateCcw size={16} /> Restaurar
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => permanentDeleteAnamnesis(anam.id)}
                              className="text-red-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* New Client View */}
          {isAddingClient && (
             <motion.div 
              key="add-client"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto space-y-8"
            >
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsAddingClient(false)}>
                  <ArrowLeft size={18} />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight">Novo Cadastro</h2>
              </div>
              <Card className="p-8">
                <ClientForm onSuccess={() => setIsAddingClient(false)} />
              </Card>
            </motion.div>
          )}

          {/* Client Details View */}
          {selectedClient && (
            <motion.div 
              key="client-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedClient(null)}>
                    <ArrowLeft size={18} />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{selectedClient.name}</h2>
                    <p className="text-sm font-mono text-gray-400">{selectedClient.phone}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    className="gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20" 
                    onClick={() => setClientSection('command')}
                  >
                    <CreditCard size={16} /> Abrir Comanda / Calcular
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteClient(selectedClient.id)} className="text-red-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-fit">
                {[
                  { id: 'anamnesis', label: 'Anamnese', icon: FileText },
                  { id: 'evolution', label: 'Evolução', icon: Activity },
                  { id: 'legacy', label: 'Histórico Legado', icon: ClipboardList },
                  { id: 'appointment', label: 'Agenda', icon: Calendar },
                  { id: 'command', label: 'Financeiro', icon: CreditCard },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setClientSection(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                      clientSection === tab.id 
                        ? "bg-white text-teal-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {clientSection === 'anamnesis' && (
                  <div className="space-y-6">
                    <header className="flex justify-between items-center">
                       <h3 className="text-lg font-bold">Ficha de Anamnese</h3>
                    </header>
                    <Card className="p-8 border-slate-100 shadow-sm">
                      <AnamnesisHandler client={selectedClient} onSoftDelete={softDeleteAnamnesis} />
                    </Card>
                  </div>
                )}

                {clientSection === 'legacy' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-bold">Histórico Legado</h3>
                      <p className="text-sm text-slate-500">Notas e registros importados de sistemas anteriores.</p>
                    </header>
                    <Card className="p-8">
                      <textarea 
                        className="w-full h-80 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-teal-500 font-medium resize-none"
                        placeholder="Cole aqui o histórico antigo do cliente..."
                        defaultValue={selectedClient.legacyHistory || ''}
                        onBlur={(e) => updateLegacyHistory(e.target.value)}
                      />
                      <p className="mt-4 text-xs text-slate-400 italic">As edições são salvas automaticamente ao clicar fora da caixa de texto.</p>
                    </Card>
                  </div>
                )}

                {clientSection === 'evolution' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-bold">Evolução e Ocorrências</h3>
                      <p className="text-sm text-slate-500">Acompanhamento detalhado do tratamento com fotos e notas.</p>
                    </header>
                    <EvolutionHandler client={selectedClient} />
                  </div>
                )}

                {clientSection === 'appointment' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                      <header>
                        <h3 className="text-lg font-bold">Novo Agendamento</h3>
                        <p className="text-sm text-slate-500">Reserve um horário para {selectedClient.name}.</p>
                      </header>
                      <Card className="p-8">
                        <AppointmentForm client={selectedClient} onSuccess={() => {
                          setClientSection('appointment');
                        }} />
                      </Card>
                    </div>
                    <div className="space-y-6">
                      <header>
                        <h3 className="text-lg font-bold">Próximos Horários</h3>
                        <p className="text-sm text-slate-500">Compromissos agendados para este cliente.</p>
                      </header>
                      <div className="space-y-4">
                        {appointments.filter(a => a.clientId === selectedClient.id).length === 0 ? (
                          <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                             <p className="text-slate-400 text-sm">Nenhum agendamento encontrado.</p>
                          </div>
                        ) : (
                          <>
                            {appointments
                              .filter(a => a.clientId === selectedClient.id)
                              .sort((a, b) => b.date.getTime() - a.date.getTime()) // Newest first for history
                              .slice(0, 10)
                              .map(a => {
                                const profColor = professionals.find(p => p.id === a.professionalId)?.color;
                                return (
                                  <Card key={a.id} className="p-4 flex justify-between items-center border-slate-100 overflow-hidden relative">
                                    {profColor && (
                                      <div 
                                        className="absolute left-0 top-0 bottom-0 w-1" 
                                        style={{ backgroundColor: profColor }} 
                                      />
                                    )}
                                   <div className="flex gap-4 items-center">
                                     <div className={cn(
                                       "w-10 h-10 rounded-lg flex flex-col items-center justify-center",
                                       a.status === 'attended' ? "bg-slate-50 text-slate-400" : "bg-teal-50 text-teal-600"
                                     )}>
                                       <p className="text-[10px] font-bold uppercase">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(a.date)}</p>
                                       <p className="text-sm font-bold">{a.date.getDate()}</p>
                                     </div>
                                     <div>
                                       <p className="text-xs font-bold text-slate-400 uppercase">
                                         {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}
                                         {a.endDate && ` - ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.endDate)}`}
                                       </p>
                                       <p className="text-sm font-bold text-slate-700">{a.serviceName || 'Serviço não especificado'}</p>
                                       {a.professionalName && <p className="text-[10px] text-slate-400 font-bold uppercase">Pro: {a.professionalName}</p>}
                                     </div>
                                   </div>
                                   <div className="flex gap-2">
                                     <Button 
                                       variant="outline" 
                                       size="icon" 
                                       onClick={() => syncToGoogleCalendar(a)}
                                       className="text-teal-600 border-teal-100"
                                       title="Exportar para Google Agenda"
                                     >
                                       <Calendar size={16} />
                                     </Button>
                                     <Button 
                                       variant="outline" 
                                       size="icon" 
                                       onClick={() => {
                                         const msg = `Olá ${a.clientName.split(' ')[0]}, Podemos Confirmar seu horário ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date)}, as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}h.?`;
                                         window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                       }}
                                       className="text-emerald-500 border-emerald-100"
                                       title="Confirmar Horário"
                                     >
                                       <MessageCircle size={16} />
                                     </Button>
                                     <Button 
                                       variant="outline" 
                                       size="icon" 
                                       onClick={() => {
                                         const dateStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date);
                                         const timeStr = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date);
                                         const msg = `Seu horário foi agendado com sucesso para Dia *${dateStr} as ${timeStr}h*\n\n🔴Tempo de tolerância para atraso é de *5 minutos.* Após faremos um novo agendamento, \n\n🔴*Em caso de desistência ou troca de horário por gentileza avisar com 4 horas de antecedência.*\n\n💰Forma de pagamentos:credito, débito Pix. No ato do check in.\n\n🔴*Evite Trazer Acompanhantes.*\n\nSiga nosso Instagram e fique por dentro das novidades 👇🏻\n\nhttps://www.instagram.com/podologaandressakupferman/\n\n*Por favor leia as regras da empresa,para não haver constrangimentos* 👆🏻`;
                                         window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                       }}
                                       className="text-teal-600 border-teal-100"
                                       title="Enviar Regras de Agendamento"
                                     >
                                       <ExternalLink size={16} />
                                     </Button>
                                     <Button 
                                       variant="ghost" 
                                       size="icon" 
                                       onClick={() => deleteAppointment(a.id)}
                                       className="text-slate-300 hover:text-red-500"
                                     >
                                       <Trash2 size={16} />
                                     </Button>
                                   </div>
                                 </Card>
                               );
                             })}
                           {appointments.filter(a => a.clientId === selectedClient.id).length > 10 && (
                              <p className="text-center text-xs text-slate-400 py-2 italic font-medium">Exibindo os 10 agendamentos mais recentes.</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {clientSection === 'command' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                      <header>
                        <h3 className="text-lg font-bold">Nova Comanda</h3>
                        <p className="text-sm text-slate-500">Registre os serviços realizados hoje.</p>
                      </header>
                      <Card className="p-8 bg-slate-900 border-none shadow-xl shadow-teal-900/10">
                        <div className="mb-6">
                           <h4 className="text-white font-bold opacity-90">Serviços Prestados</h4>
                           <p className="text-white text-[10px] uppercase tracking-widest opacity-40">Adicione os serviços para cobrança.</p>
                        </div>
                        <div className="[&_label]:text-slate-400 [&_input]:bg-slate-800 [&_input]:border-slate-700 [&_input]:text-white [&_input:focus]:bg-slate-700 [&_select]:bg-slate-800 [&_select]:border-slate-700 [&_select]:text-white">
                          <CommandForm 
                            client={selectedClient} 
                            initialServices={pendingCommandServices}
                            onSuccess={() => {
                              setPendingCommandServices([]);
                              setSelectedClient(null);
                              setActiveTab('dashboard');
                            }} 
                          />
                        </div>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <header>
                        <h3 className="text-lg font-bold">Histórico do Cliente</h3>
                        <p className="text-sm text-slate-500">Últimas comandos e pagamentos.</p>
                      </header>
                      <div className="space-y-4">
                        {commands.filter(c => c.clientId === selectedClient.id).length === 0 ? (
                          <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                             <p className="text-slate-400 text-sm">Nenhum histórico financeiro encontrado.</p>
                          </div>
                        ) : (
                          <>
                            {commands
                              .filter(c => c.clientId === selectedClient.id)
                              .slice(0, clientFinanceLimit)
                              .map(c => (
                                <Card key={c.id} className="p-4 flex justify-between items-center border-slate-100">
                                   <div>
                                     <p className="text-xs font-bold text-slate-400 uppercase">{formatDate(c.date?.toDate())}</p>
                                     <p className="text-sm font-bold text-slate-700">{c.services.map(s => s.name).join(', ')}</p>
                                   </div>
                                   <div className="text-right">
                                     <p className="text-sm font-bold text-teal-600">{formatCurrency(c.total)}</p>
                                     <span className={cn(
                                       "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                                       c.status === 'paid' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                                     )}>
                                       {c.status === 'paid' ? 'Pago' : 'Pendente'}
                                     </span>
                                   </div>
                                </Card>
                              ))}
                            {commands.filter(c => c.clientId === selectedClient.id).length > clientFinanceLimit && (
                              <div className="flex justify-center pt-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setClientFinanceLimit(prev => prev + 10)}
                                  className="text-teal-600 hover:bg-teal-50"
                                >
                                  Ver comandos antigos
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Modal 
        isOpen={isAppointmentModalOpen} 
        onClose={() => setIsAppointmentModalOpen(false)} 
        title="Agendar Horário"
      >
        <AppointmentForm 
          onSuccess={() => setIsAppointmentModalOpen(false)} 
          initialDate={selectedAgendaDate}
          initialTime={appointmentInitialTime}
        />
      </Modal>

      <Modal
        isOpen={!!editingCommand}
        onClose={() => setEditingCommand(null)}
        title="Editar Comanda"
      >
        {editingCommand && (
          <div className="bg-slate-900 p-8 rounded-2xl -m-6 [&_label]:text-slate-400 [&_input]:bg-slate-800 [&_input]:border-slate-700 [&_input]:text-white [&_input:focus]:bg-slate-700 [&_select]:bg-slate-800 [&_select]:border-slate-700 [&_select]:text-white">
            <CommandForm
              client={clients.find(c => c.id === editingCommand?.clientId) || { id: editingCommand?.clientId, name: editingCommand?.clientName, phone: '', email: '', createdAt: new Date() } as Client}
              initialCommand={editingCommand}
              onSuccess={() => {
                setEditingCommand(null);
                alert('Comanda atualizada com sucesso!');
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!transactionModal?.isOpen}
        onClose={() => setTransactionModal(null)}
        title={transactionModal?.type === 'advance' ? 'Novo Vale' : 'Fechar Pagamento'}
      >
        {transactionModal && (
          <div className="bg-slate-900 p-8 rounded-2xl -m-6">
            <ProfessionalTransactionForm
              professionalId={transactionModal.professionalId}
              type={transactionModal.type}
              onSuccess={() => {
                setTransactionModal(null);
                alert('Transação registrada com sucesso!');
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

// Helper to fetch/manage anamnesis data
function AnamnesisHandler({ client, onSoftDelete }: { client: Client, onSoftDelete: (id: string) => void }) {
  const [anamnesis, setAnamnesis] = useState<Anamnesis | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'anamnesis', client.id), (doc) => {
      if (doc.exists()) {
        setAnamnesis({ id: doc.id, ...doc.data() } as Anamnesis);
      } else {
        setAnamnesis(undefined);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [client.id]);

  if (loading) return <div className="h-40 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }} className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full" /></div>;

  if (anamnesis?.isDeleted) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
          <Trash2 size={32} />
        </div>
        <p className="text-slate-500 font-medium tracking-tight">Esta ficha está na lixeira.</p>
        <p className="text-xs text-slate-400">Vá até a aba Lixeira lateral para restaurá-la.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {anamnesis && (
        <div className="flex justify-end -mb-10 relative z-10">
          <Button variant="ghost" size="sm" onClick={() => onSoftDelete(client.id)} className="text-slate-400 hover:text-red-500 gap-2 h-8">
            <Trash2 size={13} /> Mover para Lixeira
          </Button>
        </div>
      )}
      <AnamnesisForm 
        client={client} 
        initialData={anamnesis} 
        onSuccess={() => alert('Ficha atualizada com sucesso!')} 
      />
    </div>
  );
}

function EvolutionHandler({ client }: { client: Client }) {
  const [evolutions, setEvolutions] = useState<EvolutionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [evolutionLimit, setEvolutionLimit] = useState(5);
  const [hasMoreEvolutions, setHasMoreEvolutions] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'clients', client.id, 'evolution'),
      orderBy('date', 'desc'),
      limit(evolutionLimit)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setEvolutions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvolutionEntry)));
      setHasMoreEvolutions(snapshot.docs.length === evolutionLimit);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `clients/${client.id}/evolution`));
    return () => unsub();
  }, [client.id, evolutionLimit]);

  if (loading) return <div className="h-40 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }} className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Histórico de Evolução</h4>
        <Button size="sm" onClick={() => setIsAdding(!isAdding)} className="gap-2 bg-slate-900">
          {isAdding ? <XCircle size={16} /> : <Plus size={16} />} 
          {isAdding ? 'Fechar' : 'Novo Registro'}
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 bg-slate-50/50 border-slate-200">
              <EvolutionForm client={client} onSuccess={() => setIsAdding(false)} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {evolutions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">Nenhum registro de evolução encontrado.</p>
          </div>
        ) : (
          <>
            {evolutions.map((entry) => (
              <Card key={entry.id} className="p-6 space-y-4 border-slate-100 hover:border-slate-200 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-teal-600 font-bold text-xs uppercase tracking-widest">
                    <Calendar size={14} />
                    {formatDate(entry.date?.toDate())}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-300 hover:text-red-500"
                    onClick={async () => {
                      if (confirm('Excluir esta ocorrência?')) {
                        await deleteDoc(doc(db, 'clients', client.id, 'evolution', entry.id));
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                  {entry.images && entry.images.length > 0 && (
                    <div className="w-full md:w-32 shrink-0 flex gap-2 overflow-x-auto pb-2 md:pb-0 md:flex-col">
                      {entry.images.map((photo, i) => (
                        <img 
                          key={i} 
                          src={photo} 
                          alt="Evolução" 
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 md:w-full md:h-24 object-cover rounded-lg border border-slate-100" 
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {entry.description}
                    </p>
                    {entry.professionalName && (
                      <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase">Atendido por: {entry.professionalName}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {hasMoreEvolutions && (
              <div className="flex justify-center pt-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEvolutionLimit(prev => prev + 5)}
                  className="text-teal-600 hover:bg-teal-50"
                >
                  Ver Evoluções Anteriores
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

