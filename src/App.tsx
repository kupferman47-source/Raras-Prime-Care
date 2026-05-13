import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc, setDoc, addDoc, serverTimestamp, limit, getDocs, writeBatch } from 'firebase/firestore';
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
  BarChart3,
  Zap,
  LayoutGrid,
  List,
  Cake,
  Star,
  Loader2,
  Printer
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
  ClientImporter,
  AppointmentForm,
  LocationForm,
  ProfessionalTransactionForm,
  ProfessionalLoginForm
} from './components/Forms';
import { FeedbackForm } from './components/FeedbackForm';
import { ClientMerger } from './components/ClientMerger';
import { Professional, RegisteredService, Appointment, ClinicBranch, ProfessionalTransaction, Feedback } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'professional' | null>(null);
  const [loggedProfessionalId, setLoggedProfessionalId] = useState<string | null>(null);
  const [professionalSession, setProfessionalSession] = useState<Professional | null>(null);
  const [loginMode, setLoginMode] = useState<'google' | 'professional'>('google');
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'finance' | 'settings' | 'trash' | 'services' | 'agenda' | 'birthdays' | 'professionals_history'>('dashboard');
  const [clientSection, setClientSection] = useState<'registration' | 'anamnesis' | 'evolution' | 'appointment' | 'command' | 'legacy'>('registration');
  const [pendingCommandServices, setPendingCommandServices] = useState<Service[]>([]);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(500);
  const [clientsLimit, setClientsLimit] = useState(5000); // Increased limit for better pagination
  const [hasMoreClients, setHasMoreClients] = useState(true);
  
  const [commands, setCommands] = useState<Command[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLimit, setAppointmentsLimit] = useState(50);
  const [financeLimit, setFinanceLimit] = useState(20);
  const [clientFinanceLimit, setClientFinanceLimit] = useState(10);
  
  const [deletedAnamnesis, setDeletedAnamnesis] = useState<Anamnesis[]>([]);
  const [deletedClients, setDeletedClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<RegisteredService[]>([]);
  const [locations, setLocations] = useState<ClinicBranch[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isImportingClients, setIsImportingClients] = useState(false);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInitial, setSelectedInitial] = useState<string | null>(null);
  const [clientViewMode, setClientViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentInitialTime, setAppointmentInitialTime] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [professionalTransactions, setProfessionalTransactions] = useState<ProfessionalTransaction[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [transactionModal, setTransactionModal] = useState<{ isOpen: boolean, type: 'payment' | 'advance', professionalId: string } | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Auth Listener
  useEffect(() => {
    // Check for professional session in localStorage
    const savedSession = localStorage.getItem('professional_session');
    if (savedSession) {
      try {
        const pro = JSON.parse(savedSession);
        setProfessionalSession(pro);
        setUserRole('professional');
        setLoggedProfessionalId(pro.id);
      } catch (e) {
        localStorage.removeItem('professional_session');
      }
    }

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setProfessionalSession(null); // Clear professional if google logged in
        localStorage.removeItem('professional_session');

        // Simple role detection
        const adminEmails = [
          'kupferman47@gmail.com', 
          ...(settings?.adminEmails || [])
        ];

        if (adminEmails.includes(u.email || '')) {
          setUserRole('admin');
          setLoggedProfessionalId(null);
        } else {
          // Check if this user is a registered professional
          const q = query(collection(db, 'professionals'), where('email', '==', u.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setUserRole('professional');
            setLoggedProfessionalId(snap.docs[0].id);
          } else {
            // Default to restricted if not found
            setUserRole('professional');
            setLoggedProfessionalId('not-found');
          }
        }
      } else if (!savedSession) {
        setUserRole(null);
        setLoggedProfessionalId(null);
      }
      setAuthReady(true);
    });
  }, [settings?.adminEmails]);

  const handleProfessionalLogin = (pro: Professional) => {
    setProfessionalSession(pro);
    setUserRole('professional');
    setLoggedProfessionalId(pro.id);
    localStorage.setItem('professional_session', JSON.stringify(pro));
  };

  const handleLogout = () => {
    if (professionalSession) {
      setProfessionalSession(null);
      setUserRole(null);
      setLoggedProfessionalId(null);
      localStorage.removeItem('professional_session');
    } else {
      logout();
    }
  };

  // Data Listeners
  useEffect(() => {
    if (!user && !professionalSession) return;

    const clientsQuery = query(collection(db, 'clients'), where('isDeleted', '!=', true), limit(clientsLimit));
    const unsubClients = onSnapshot(clientsQuery, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setHasMoreClients(snapshot.docs.length === clientsLimit);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const deletedClientsQuery = query(collection(db, 'clients'), where('isDeleted', '==', true));
    const unsubDeletedClients = onSnapshot(deletedClientsQuery, (snapshot) => {
      setDeletedClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients/deleted'));

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

    let unsubFeedbacks = () => {};
    if (userRole === 'admin') {
      unsubFeedbacks = onSnapshot(query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
        setFeedbacks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Feedback)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'feedbacks'));
    }

    return () => {
      unsubClients();
      unsubDeletedClients();
      unsubCommands();
      unsubSettings();
      unsubDeletedAnamnesis();
      unsubProfessionals();
      unsubServicesCatalog();
      unsubLocations();
      unsubAppointments();
      unsubTransactions();
      unsubFeedbacks();
    };
  }, [user, professionalSession, userRole]);

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

  // Feedback Page Bypass
  const feedbackIdFromUrl = new URLSearchParams(window.location.search).get('feedbackId');
  if (feedbackIdFromUrl) {
    return <FeedbackForm appointmentId={feedbackIdFromUrl} />;
  }

  if (!user && !professionalSession) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <ClipboardList className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Raras Prime Care</h1>
            <p className="text-slate-500 text-sm">Gestão especializada para sua clínica.</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200 border border-slate-50 space-y-6">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setLoginMode('google')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  loginMode === 'google' ? "bg-white text-teal-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Administrador
              </button>
              <button 
                onClick={() => setLoginMode('professional')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  loginMode === 'professional' ? "bg-white text-teal-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Colaborador
              </button>
            </div>

            {loginMode === 'google' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Acesso via Google</p>
                <Button onClick={loginWithGoogle} className="w-full py-4 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-900/10">
                  Entrar com Google
                </Button>
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  Utilize seu e-mail administrativo para acessar todas as funcionalidades financeiras e de gestão.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <ProfessionalLoginForm onLogin={handleProfessionalLogin} />
              </div>
            )}
          </div>
          
          <p className="mt-8 text-[9px] text-slate-400 uppercase tracking-widest font-bold text-center opacity-50">
            Poder Tecnológico para Podologia
          </p>
        </motion.div>
      </div>
    );
  }

  // Filtered Data
  const sortedClients = clients
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.phone.includes(searchQuery);
      const matchesInitial = !selectedInitial || c.name.trim().toUpperCase().startsWith(selectedInitial);
      return matchesSearch && matchesInitial;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const paginatedClients = sortedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredClients = paginatedClients;

  const calculateCompanyProfit = (cmdList: Command[]) => {
    return cmdList.reduce((acc, c) => {
      const totalComm = c.services.reduce((sum, s) => sum + (s.commissionValue || 0), 0);
      let net = c.netTotal;
      if (net === undefined) {
        const feePercent = getFeePercent(c);
        net = c.total * (1 - feePercent / 100);
      }
      return acc + (net || 0) - totalComm;
    }, 0);
  };

  const calculateGrossTotal = (cmdList: Command[]) => {
    return cmdList.reduce((acc, c) => acc + (c.total || 0), 0);
  };

  const filteredAppointments = userRole === 'admin' 
    ? (selectedProfessionalId ? appointments.filter(a => a.professionalId === selectedProfessionalId) : appointments)
    : appointments.filter(a => a.professionalId === loggedProfessionalId);

  const filteredCommands = userRole === 'admin'
    ? commands
    : commands.filter(c => c.services.some(s => s.professionalId === loggedProfessionalId));

  const filteredTransactions = userRole === 'admin'
    ? professionalTransactions
    : professionalTransactions.filter(t => t.professionalId === loggedProfessionalId);

  const selectedProf = professionals.find(p => p.id === selectedProfessionalId);

  const getFeePercent = (cmd: Partial<Command>) => {
    if (!settings || !settings.fees) return 0;
    const fees = settings.fees;
    const method = cmd.paymentMethod;
    const brand = cmd.cardBrand;
    const inst = cmd.installments || 1;

    if (method === 'Cartão de Débito') {
      const isEloAmex = brand === 'Elo' || brand === 'Amex' || brand === 'Hipercard';
      return (isEloAmex ? fees.debitEloAmex : fees.debitVisaMaster) || 0;
    }
    if (method === 'Cartão de Crédito') {
      const isEloAmex = brand === 'Elo' || brand === 'Amex' || brand === 'Hipercard';
      const rates = isEloAmex ? fees.creditEloAmex : fees.creditVisaMaster;
      return rates?.[inst - 1] || 0;
    }
    if (method === 'Link de Pagamento') return fees.paymentLink?.[inst - 1] || 0;
    return 0;
  };

  const getClientDisplayName = (name: string, pId?: string) => {
    if (userRole === 'admin') return name;
    if (pId === loggedProfessionalId) return name;
    // Attempt to see if any service in any command of ours has this client? 
    // Simplified: if current appointment belongs to professional, show it.
    return "Paciente";
  };

  const openCommands = filteredCommands.filter(c => c.status === 'open');
  const paidCommands = filteredCommands.filter(c => c.status === 'paid');

  const calculateProfessionalBalance = (pId: string) => {
    const totalComm = commands
      .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === pId))
      .reduce((acc, c) => acc + c.services
        .filter(s => s.professionalId === pId)
        .reduce((sum, s) => sum + (s.commissionValue || 0), 0), 0
      );
    const paidTransactions = professionalTransactions
      .filter(t => t.professionalId === pId && t.type === 'payment')
      .reduce((acc, t) => acc + t.amount, 0);
    const advances = professionalTransactions
      .filter(t => t.professionalId === pId && t.type === 'advance')
      .reduce((acc, t) => acc + t.amount, 0);
    return totalComm - paidTransactions - advances;
  };

  const updateCommandStatus = async (id: string, status: 'paid' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'commands', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `commands/${id}`);
    }
  };

  const deleteSelectedClients = async () => {
    if (selectedClientIds.length === 0) return;
    if (!confirm(`Deseja enviar ${selectedClientIds.length} clientes para a lixeira?`)) return;

    try {
      setIsProcessing(true);
      const chunks = [];
      for (let i = 0; i < selectedClientIds.length; i += 100) {
        chunks.push(selectedClientIds.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const id of chunk) {
          batch.update(doc(db, 'clients', id), {
            isDeleted: true,
            deletedAt: serverTimestamp()
          });
          
          // Also soft delete anamnesis
          // Use another update if needed, but since batch must have valid docs, 
          // and anamnesis ID matches client ID, it should work IF doc exists.
          // If we are not sure anamnesis exists for every client, we can't easily batch it 
          // without checking existence first.
          // For now, I'll only batch things we are sure about OR that can fail the whole batch if missing.
          // Actually, if a doc doesn't exist, batch.update fails the whole batch.
          // So I will remove the anamnesis soft delete from the bulk batch to avoid breaking it 
          // for clients without anamnesis.
        }
        await batch.commit();
      }

      setSelectedClientIds([]);
      if (selectedClient && selectedClientIds.includes(selectedClient.id)) {
        setSelectedClient(null);
      }
      alert('Clientes enviados para a lixeira com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bulk-clients');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllClients = async () => {
    if (confirm("ATENÇÃO: Você tem certeza que deseja APAGAR TODOS os clientes? Esta ação é irreversível e removerá todos os registros permanentemente.")) {
      const password = prompt("Para confirmar, digite: APAGAR");
      if (password?.toUpperCase() === "APAGAR") {
        try {
          setIsProcessing(true);
          const snapshot = await getDocs(collection(db, 'clients'));
          const total = snapshot.docs.length;
          
          if (total === 0) {
            alert("Nenhum cliente encontrado para remover.");
            return;
          }

          // Delete in batches of 500
          for (let i = 0; i < total; i += 500) {
            const batch = writeBatch(db);
            const chunk = snapshot.docs.slice(i, i + 500);
            chunk.forEach(d => {
              batch.delete(d.ref);
              // Also try to delete anamnesis for this client (matches ID)
              batch.delete(doc(db, 'anamnesis', d.id));
            });
            await batch.commit();
          }
          
          alert(`Sucesso! ${total} clientes foram removidos da base.`);
          setClients([]);
          setSelectedClientIds([]);
          setSelectedClient(null);
        } catch (err: any) {
          console.error("Erro ao limpar base:", err);
          alert(`Erro ao limpar base de dados: ${err.message}`);
        } finally {
          setIsProcessing(false);
        }
      }
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
    if (!confirm('Deseja enviar este cliente para a lixeira?')) return;
    try {
      setIsProcessing(true);
      
      // Update client to be soft deleted
      await updateDoc(doc(db, 'clients', id), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
      
      // Also soft delete associated anamnesis if it exists
      try {
        await updateDoc(doc(db, 'anamnesis', id), {
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
      } catch (e) {
        // If it doesn't exist, ignore
      }

      setSelectedClient(null);
      alert('Cliente enviado para a lixeira!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const restoreClient = async (id: string) => {
    try {
      setIsProcessing(true);
      await updateDoc(doc(db, 'clients', id), {
        isDeleted: false,
        deletedAt: null
      });
      alert('Cliente restaurado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const permanentDeleteClient = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente este cliente? Esta ação apagará TODOS os dados, agendamentos, evoluções e históricos e NÃO pode ser desfeita.')) return;
    try {
      setIsProcessing(true);
      
      // 1. Delete Evolution Subcollection
      const evolRef = collection(db, 'clients', id, 'evolution');
      const evolSnap = await getDocs(evolRef);
      for (const d of evolSnap.docs) {
        await deleteDoc(d.ref);
      }
      
      // 2. Delete Appointments
      const clientApps = appointments.filter(a => a.clientId === id);
      for (const app of clientApps) {
        await deleteDoc(doc(db, 'appointments', app.id));
      }

      // 3. Delete Anamnesis
      try {
        await deleteDoc(doc(db, 'anamnesis', id));
      } catch (e) {}

      // 4. Delete Client Document
      await deleteDoc(doc(db, 'clients', id));
      
      alert('Cliente e todos os seus dados foram excluídos permanentemente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const wasMessageSentThisYear = (client: Client) => {
    if (!client.lastBirthdayMessageSentDate) return false;
    return client.lastBirthdayMessageSentDate.startsWith(new Date().getFullYear().toString());
  };

  const isNewClientThisMonth = (client: Client) => {
    if (!client.createdAt) return false;
    const createdDate = client.createdAt.toDate ? client.createdAt.toDate() : new Date(client.createdAt);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  };

  const markBirthdaySent = async (clientId: string) => {
    try {
      const todayString = new Date().toISOString().split('T')[0];
      await updateDoc(doc(db, 'clients', clientId), {
        lastBirthdayMessageSentDate: todayString
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const deleteProfessional = async (id: string) => {
    if (user && !user.emailVerified) {
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
    if (user && !user.emailVerified) {
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
    if (user && !user.emailVerified) {
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

  const normalizeDateParts = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length < 3) return null;
      // Handle YYYY-MM-DD or DD-MM-YYYY (assume YYYY-MM-DD if first part is 4 chars)
      if (parts[0].length === 4) return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) };
      return { y: parseInt(parts[2]), m: parseInt(parts[1]), d: parseInt(parts[0]) };
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length < 3) return null;
      return { y: parseInt(parts[2]), m: parseInt(parts[1]), d: parseInt(parts[0]) };
    }
    return null;
  };

  const birthdayClientsToday = clients.filter(c => {
    const parts = normalizeDateParts(c.birthDate);
    if (!parts) return false;
    return parts.m === currentMonth && parts.d === currentDay;
  });

  const birthdayClientsMonth = clients.filter(c => {
    const parts = normalizeDateParts(c.birthDate);
    if (!parts) return false;
    return parts.m === currentMonth && parts.d !== currentDay;
  }).sort((a, b) => {
    const partsA = normalizeDateParts(a.birthDate);
    const partsB = normalizeDateParts(b.birthDate);
    return (partsA?.d || 0) - (partsB?.d || 0);
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <nav id="sidebar" className="w-full md:w-20 bg-slate-900 border-b md:border-b-0 p-3 md:p-4 flex flex-wrap md:flex-col items-center justify-center md:justify-start gap-2 md:gap-6 z-40 sticky top-0 md:h-screen">
          <div className="hidden md:flex items-center justify-center w-12 h-12 bg-teal-500 rounded-xl mb-4 shrink-0">
            <span className="text-white font-bold text-lg">PC</span>
          </div>

          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
               "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
               activeTab === 'dashboard' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Dashboard"
          >
            <LayoutDashboard size={22} className="md:w-6 md:h-6" />
          </button>
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('clients'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === 'clients' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Clientes"
          >
            <Users size={22} className="md:w-6 md:h-6" />
          </button>
        )}
        <button 
          onClick={() => { setActiveTab('agenda'); setSelectedClient(null); setIsAddingClient(false); }}
          className={cn(
            "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
            activeTab === 'agenda' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Agenda"
        >
          <Calendar size={22} className="md:w-6 md:h-6" />
        </button>
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('finance'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === 'finance' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Financeiro"
          >
            <CreditCard size={22} className="md:w-6 md:h-6" />
          </button>
        )}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('services'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === 'services' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Serviços e Profissionais"
          >
            <Briefcase size={22} className="md:w-6 md:h-6" />
          </button>
        )}

        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('birthdays'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0 relative",
              activeTab === 'birthdays' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Aniversariantes"
          >
            <Cake size={22} className="md:w-6 md:h-6" />
            {(birthdayClientsToday.some(c => !wasMessageSentThisYear(c)) || 
              birthdayClientsMonth.some(c => !wasMessageSentThisYear(c))) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
            )}
          </button>
        )}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('feedbacks' as any); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === ('feedbacks' as any) ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Avaliações"
          >
            <Star size={22} className="md:w-6 md:h-6" />
          </button>
        )}
        <button 
          onClick={() => { 
            setActiveTab('professionals_history'); 
            setSelectedClient(null); 
            setIsAddingClient(false); 
            if (userRole !== 'admin' && loggedProfessionalId) {
              setSelectedProfessionalId(loggedProfessionalId);
            }
          }}
          className={cn(
            "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
            activeTab === 'professionals_history' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
          )}
          title="Histórico Profissional"
        >
          <BarChart3 size={22} className="md:w-6 md:h-6" />
        </button>
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('settings'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === 'settings' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Configurações"
          >
            <SettingsIcon size={22} className="md:w-6 md:h-6" />
          </button>
        )}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setActiveTab('trash'); setSelectedClient(null); setIsAddingClient(false); }}
            className={cn(
              "flex items-center justify-center p-2.5 md:p-3 rounded-xl transition-all shrink-0",
              activeTab === 'trash' ? "bg-teal-500/20 text-teal-400 shadow-sm" : "text-slate-400 hover:text-white"
            )}
            title="Lixeira"
          >
            <Trash size={22} className="md:w-6 md:h-6" />
          </button>
        )}

        <div className="md:mt-auto flex md:flex-col items-center gap-2 md:gap-6 shrink-0">
          <button onClick={handleLogout} className="flex items-center justify-center p-2.5 md:p-3 rounded-xl text-slate-500 hover:text-white transition-all">
            <LogOut size={22} className="md:w-6 md:h-6" />
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
                  <p className="text-gray-500 mt-1">Bem-vindo de volta, {(user?.displayName || professionalSession?.name || '').split(' ')[0]}.</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p>
                  </div>
                  {userRole === 'admin' && (
                    <Button size="sm" className="gap-2 bg-emerald-600" onClick={() => {
                      setActiveTab('clients');
                      alert('Selecione um cliente para abrir a comanda.');
                    }}>
                      <CreditCard size={14} /> Abrir Comanda
                    </Button>
                  )}
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
                      {filteredAppointments.filter(a => {
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
                <Card className={cn("p-6 flex flex-col justify-between h-32 border-l-4", userRole === 'admin' ? "border-l-amber-500" : "border-l-emerald-500 bg-emerald-50/20")}>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {userRole === 'admin' ? 'Total de Clientes' : 'Saldo de Comissões'}
                  </span>
                  <div className="flex justify-between items-end">
                    <span className={cn("text-4xl font-bold font-mono", userRole === 'admin' ? "text-slate-800" : "text-emerald-600")}>
                      {userRole === 'admin' ? clients.length : formatCurrency(calculateProfessionalBalance(loggedProfessionalId || ''))}
                    </span>
                    {userRole === 'admin' ? <Users size={20} className="text-amber-500 mb-1" /> : <DollarSign size={20} className="text-emerald-500 mb-1" />}
                  </div>
                </Card>
                <Card className="p-6 flex flex-col justify-between h-32 border-l-4 border-l-teal-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {userRole === 'admin' ? 'Receita (Aberto)' : 'Atendimentos Realizados'}
                  </span>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold font-mono text-teal-700">
                      {userRole === 'admin' 
                        ? formatCurrency(openCommands.reduce((acc, c) => acc + c.total, 0))
                        : filteredCommands.filter(c => c.status === 'paid').length}
                    </span>
                    {userRole === 'admin' ? <CreditCard size={20} className="text-teal-700 mb-1" /> : <CheckCircle2 size={20} className="text-teal-700 mb-1" />}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Próximos Agendamentos</h3>
                  <div className="space-y-3">
                    {filteredAppointments
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

                {userRole === 'admin' && (
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
              )}
              </div>
          </motion.div>
        )}

          {/* Clients View */}
          {activeTab === 'clients' && !selectedClient && !isAddingClient && !isImportingClients && !isMergingDuplicates && (
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
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={clearAllClients}
                    className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={18} /> Limpar Base
                  </Button>
                  <Button 
                    onClick={() => setIsMergingDuplicates(true)} 
                    variant="outline" 
                    className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Mesclar nomes e números repetidos"
                  >
                    <Users size={18} /> Mesclar
                  </Button>
                  <Button onClick={() => setIsImportingClients(true)} variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                    <UploadCloud size={18} /> Importar
                  </Button>
                  <Button onClick={() => setIsAddingClient(true)} className="gap-2">
                    <Plus size={18} /> Novo Cliente
                  </Button>
                  <Button 
                    onClick={() => {
                      setSelectedClient({ id: 'guest', name: 'Cliente Avulso', phone: '', birthDate: '', address: '', createdAt: null } as any);
                      setClientSection('command');
                    }} 
                    variant="outline"
                    className="gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Zap size={18} /> Comanda Rápida
                  </Button>
                  {selectedClientIds.length > 0 && (
                    <Button 
                      onClick={deleteSelectedClients}
                      variant="outline" 
                      className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all font-bold animate-in fade-in zoom-in-95 duration-200"
                    >
                      <Trash2 size={18} /> Excluir ({selectedClientIds.length})
                    </Button>
                  )}
                </div>
              </header>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Buscar por nome ou telefone..." 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-300 outline-none transition-all"
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1); // Reset to page 1 on search
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0) {
                            setSelectedClientIds([]);
                          } else {
                            setSelectedClientIds(paginatedClients.map(c => c.id));
                          }
                        }}
                        className={cn(
                          "gap-2 border-slate-200 text-slate-600 hover:bg-slate-50",
                          selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0 && "bg-teal-50 border-teal-200 text-teal-600"
                        )}
                      >
                        {selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0 ? (
                          <XCircle size={18} />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        Marcar Todos ({paginatedClients.length})
                      </Button>

                      {selectedClientIds.length > 0 && (
                        <Button 
                          variant="ghost" 
                          onClick={deleteSelectedClients}
                          className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 bg-red-50/10"
                        >
                          <Trash2 size={18} /> Excluir ({selectedClientIds.length})
                        </Button>
                      )}

                      <div className="flex bg-white border border-slate-100 p-1 rounded-2xl shadow-sm self-stretch md:self-auto">
                        <button 
                          onClick={() => setClientViewMode('grid')}
                          className={cn(
                            "flex-1 md:flex-none px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all",
                            clientViewMode === 'grid' ? "bg-teal-500 text-white" : "text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          <LayoutGrid size={16} /> <span className="hidden sm:inline">Cards</span>
                        </button>
                        <button 
                          onClick={() => setClientViewMode('table')}
                          className={cn(
                            "flex-1 md:flex-none px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all",
                            clientViewMode === 'table' ? "bg-teal-500 text-white" : "text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          <List size={16} /> <span className="hidden sm:inline">Tabela</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-50 rounded-2xl shadow-sm">
                  <button
                    onClick={() => {
                      setSelectedInitial(null);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                      selectedInitial === null ? "bg-teal-500 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Todos
                  </button>
                  {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(letter => (
                    <button
                      key={letter}
                      onClick={() => {
                        setSelectedInitial(letter);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-lg transition-all",
                        selectedInitial === letter ? "bg-teal-500 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              {clientViewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClients.map(client => (
                    <Card 
                      key={client.id} 
                      className={cn(
                        "p-5 hover:border-teal-300 cursor-pointer transition-all active:scale-[0.99] group overflow-hidden relative",
                        selectedClientIds.includes(client.id) && "border-teal-500 bg-teal-50/10 shadow-md ring-2 ring-teal-100"
                      )}
                      onClick={() => setSelectedClient(client)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-bold text-slate-400 group-hover:bg-teal-600 group-hover:text-white transition-all transform group-hover:rotate-3">
                            {client.name.charAt(0)}
                          </div>
                          <div 
                            className="absolute -top-2 -left-2 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientIds(prev => 
                                prev.includes(client.id) 
                                  ? prev.filter(id => id !== client.id) 
                                  : [...prev, client.id]
                              );
                            }}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              selectedClientIds.includes(client.id) 
                                ? "bg-teal-500 border-teal-500 text-white" 
                                : "bg-white border-slate-200 group-hover:border-teal-400"
                            )}>
                              {selectedClientIds.includes(client.id) && <CheckCircle2 size={12} strokeWidth={3} />}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-slate-800 text-base">{client.name}</p>
                          <p className="text-xs text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
                            <MessageCircle size={10} /> {client.phone}
                          </p>
                          {client.createdAt && (
                            <p className="text-[10px] text-teal-600 font-bold uppercase mt-1 tracking-tighter">
                              Cliente desde: {formatDate(client.createdAt)}
                            </p>
                          )}
                          {client.birthDate && (
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              Nasc: {client.birthDate.split('-').reverse().join('/')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteClient(client.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 bg-white shadow-sm"
                          >
                            <Trash2 size={16} />
                          </Button>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <Users size={32} />
                      </div>
                      <p className="text-slate-400 font-medium italic">Nenhum cliente encontrado para este filtro.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="w-10 px-6 py-4">
                            <div 
                              className={cn(
                                "w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center transition-colors",
                                paginatedClients.length > 0 && paginatedClients.every(c => selectedClientIds.includes(c.id))
                                  ? "bg-teal-500 border-teal-500 text-white"
                                  : "bg-white border-slate-300"
                              )}
                              onClick={() => {
                                if (paginatedClients.every(c => selectedClientIds.includes(c.id))) {
                                  setSelectedClientIds(prev => prev.filter(id => !paginatedClients.some(c => c.id === id)));
                                } else {
                                  const newIds = paginatedClients.map(c => c.id);
                                  setSelectedClientIds(prev => Array.from(new Set([...prev, ...newIds])));
                                }
                              }}
                            >
                              {paginatedClients.length > 0 && paginatedClients.every(c => selectedClientIds.includes(c.id)) && <CheckCircle2 size={10} strokeWidth={4} />}
                            </div>
                          </th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Completo</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desde</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredClients.map(client => (
                          <tr 
                            key={client.id} 
                            className={cn(
                              "hover:bg-slate-50/50 cursor-pointer transition-colors group",
                              selectedClientIds.includes(client.id) && "bg-teal-50/30"
                            )}
                            onClick={() => setSelectedClient(client)}
                          >
                            <td className="px-6 py-4" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientIds(prev => 
                                prev.includes(client.id) 
                                  ? prev.filter(id => id !== client.id) 
                                  : [...prev, client.id]
                              );
                            }}>
                              <div className={cn(
                                "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                                selectedClientIds.includes(client.id)
                                  ? "bg-teal-500 border-teal-500 text-white"
                                  : "bg-white border-slate-300 group-hover:border-teal-400"
                              )}>
                                {selectedClientIds.includes(client.id) && <CheckCircle2 size={10} strokeWidth={4} />}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs uppercase">
                                  {client.name.charAt(0)}
                                </div>
                                <p className="font-bold text-slate-700">{client.name}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-500 font-mono">{client.phone}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[11px] font-bold text-teal-600 uppercase tracking-tight">{formatDate(client.createdAt)}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteClient(client.id);
                                }}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredClients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center">
                              <p className="text-slate-400 italic">Nenhum cliente encontrado.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-6 gap-4">
                  <p className="text-sm text-slate-500">
                    Mostrando <span className="font-bold text-slate-700">{Math.min(sortedClients.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(sortedClients.length, currentPage * itemsPerPage)}</span> de <span className="font-bold text-slate-700">{sortedClients.length}</span> clientes
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4"
                    >
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                        .map((p, i, arr) => (
                          <React.Fragment key={p}>
                            {i > 0 && arr[i-1] !== p - 1 && <span className="text-slate-300 px-1">...</span>}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={cn(
                                "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                currentPage === p ? "bg-teal-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}

              {hasMoreClients && sortedClients.length < 10000 && (
                <div className="flex justify-center pt-8">
                  <Button 
                    variant="ghost" 
                    onClick={() => setClientsLimit(prev => prev + 1000)}
                    className="text-slate-400 text-xs flex items-center gap-2"
                  >
                    <RotateCcw size={14} /> Carregar Mais (Base Total)
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {(activeTab === 'clients' || activeTab === 'birthdays') && isImportingClients && (
            <motion.div 
              key="import-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsImportingClients(false)} className="rounded-full hover:bg-slate-100">
                  <ArrowLeft size={24} />
                </Button>
                <div>
                   <h2 className="text-3xl font-bold tracking-tight">Importar Clientes</h2>
                   <p className="text-gray-500">Importe sua base de dados via Excel ou PDF.</p>
                </div>
              </header>

              <Card className="p-8 border-slate-100">
                <ClientImporter onImported={() => setIsImportingClients(false)} />
              </Card>
            </motion.div>
          )}

          {activeTab === 'clients' && isMergingDuplicates && (
            <motion.div 
              key="merge-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <ClientMerger 
                onComplete={() => setIsMergingDuplicates(false)} 
                onCancel={() => setIsMergingDuplicates(false)} 
              />
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
                <div className="flex flex-wrap gap-3">
                  {userRole === 'admin' ? (
                    <>
                      <select 
                        value={selectedProfessionalId || ''} 
                        onChange={(e) => setSelectedProfessionalId(e.target.value || null)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-100 min-w-[180px]"
                      >
                        <option value="">Todos Profissionais</option>
                        {professionals.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Button onClick={() => { setAppointmentInitialTime(''); setIsAppointmentModalOpen(true); }} className="gap-2">
                        <Plus size={18} /> Novo Agendamento
                      </Button>
                    </>
                  ) : (
                    <div className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl text-xs font-bold border border-teal-100 flex items-center gap-2">
                      <Zap size={14} /> Somente Leitura
                    </div>
                  )}
                  <Input 
                    type="date" 
                    value={selectedAgendaDate} 
                    onChange={(e) => setSelectedAgendaDate(e.target.value)} 
                    className="max-w-[200px]"
                  />
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
                      const hourAppointments = filteredAppointments.filter(a => {
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
                              userRole === 'admin' ? (
                                <button 
                                  onClick={() => {
                                    setAppointmentInitialTime(timeStr);
                                    setIsAppointmentModalOpen(true);
                                  }}
                                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-teal-400 font-bold text-xs uppercase tracking-widest gap-2"
                                >
                                  <Plus size={14} /> Reservar Horário
                                </button>
                              ) : null
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
                                  if (a.status === 'attended' || userRole !== 'admin') return;
                                  const client = clients.find(c => c.id === a.clientId);
                                  if (client) {
                                    setSelectedClient(client);
                                    setClientSection('appointment');
                                    setActiveTab('clients');
                                  }
                                }}>
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold text-xs truncate whitespace-nowrap">{getClientDisplayName(a.clientName, a.professionalId)}</p>
                                    <span className="text-[10px] opacity-70 font-mono">
                                      {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}
                                      {a.endDate && ` - ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.endDate)}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center gap-2">
                                    <p className="text-[10px] opacity-80 uppercase tracking-tighter truncate">
                                      {a.serviceName || 'Sem serviço'}
                                    </p>
                                  </div>
                                  {userRole === 'admin' && (
                                    <div className="flex justify-between items-end mt-1">
                                    <span className="text-[9px] font-bold opacity-60">
                                      {a.professionalName || '-'}
                                    </span>
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const location = locations.find(l => l.id === a.locationId);
                                            let locSuffix = '';
                                            if (location) {
                                              locSuffix = ` na Unidade ${location.name}`;
                                              if (location.mapsUrl) {
                                                locSuffix += ` (${location.mapsUrl})`;
                                              }
                                            }
                                            const msg = `Olá ${(a.clientName || 'Cliente').split(' ')[0]}, Podemos Confirmar seu horário ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date)}, as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}h${locSuffix}?`;
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
                                            const location = locations.find(l => l.id === a.locationId);
                                            let locInfo = '';
                                            if (location) {
                                              locInfo = `\n\n📍 *Unidade ${location.name}:* ${location.address || ''}`;
                                              if (location.mapsUrl) {
                                                locInfo += `\n🔗 *Localização:* ${location.mapsUrl}`;
                                              }
                                            }
                                            const msg = `Seu horário foi agendado com sucesso para Dia *${dateStr} as ${timeStr}h*${locInfo}\n\n🔴Tempo de tolerância para atraso é de *5 minutos.* Após faremos um novo agendamento, \n\n🔴*Em caso de desistência ou troca de horário por gentileza avisar com 4 horas de antecedência.*\n\n💰Forma de pagamentos:credito, débito Pix. No ato do check in.\n\n🔴*Evite Trazer Acompanhantes.*\n\nSiga nosso Instagram e fique por dentro das novidades 👇🏻\n\nhttps://www.instagram.com/podologaandressakupferman/\n\n*Por favor leia as regras da empresa,para não haver constrangimentos* 👆🏻`;
                                            window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                          }}
                                          className="p-1 hover:bg-white/50 rounded-full transition-colors text-teal-600"
                                          title="Enviar Regras de Agendamento"
                                        >
                                          <ExternalLink size={14} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const feedbackUrl = `${window.location.origin}${window.location.pathname}?feedbackId=${a.id}`;
                                            const msg = `Olá ${a.clientName.split(' ')[0]}, o que achou do seu atendimento? Sua opinião é muito importante para nós! Reserve 30 segundos para nos avaliar: ${feedbackUrl}`;
                                            window.open(`https://wa.me/55${a.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                          }}
                                          className="p-1 hover:bg-white/50 rounded-full transition-colors text-amber-500"
                                          title="Enviar Link de Feedback (Satisfação)"
                                        >
                                          <Star size={14} />
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
                                              let client = clients.find(c => c.id === a.clientId);
                                              
                                              if (!client) {
                                                // Create a pseudo-client for guests not in the database
                                                client = {
                                                  id: 'guest',
                                                  name: a.clientName || 'Cliente Avulso',
                                                  phone: a.clientPhone || '',
                                                  birthDate: '',
                                                  address: '',
                                                  createdAt: null
                                                } as any;
                                              }
                                              
                                              // Pre-fill the services for the command calculator
                                              const pro = professionals.find(p => p.id === a.professionalId);
                                              setPendingCommandServices([{
                                                name: a.serviceName || 'Procedimento',
                                                price: a.price || 0,
                                                professionalId: a.professionalId,
                                                professionalName: a.professionalName,
                                                commissionRate: pro?.defaultCommission || 0
                                              }]);
                                              setPendingAppointmentId(a.id);
                                              
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
                                  )}
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
                      {filteredAppointments.filter(a => {
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
                            <span className="text-sm font-bold text-slate-700">{getClientDisplayName(a.clientName, a.professionalId)}</span>
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
                        <span className="font-bold">{filteredAppointments.filter(a => a.date?.toISOString().split('T')[0] === selectedAgendaDate).length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Confirmados</span>
                        <span className="font-bold text-teal-400">
                          {filteredAppointments.filter(a => a.date?.toISOString().split('T')[0] === selectedAgendaDate && a.status === 'confirmed').length}
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
                  <h3 className="text-xl font-bold text-slate-800">Importação de Clientes e Serviços (Excel/PDF)</h3>
                </div>
                <ClientImporter onImported={() => {}} />
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
                        <Card key={pro.id} className="p-4 flex flex-col border-slate-100 bg-slate-50/30">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Nome</label>
                                <input 
                                  type="text"
                                  defaultValue={pro.name}
                                  onBlur={async (e) => {
                                    const newVal = e.target.value;
                                    if (!newVal || newVal === pro.name) return;
                                    try {
                                      await updateDoc(doc(db, 'professionals', pro.id), { name: newVal });
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.UPDATE, `professionals/${pro.id}`);
                                    }
                                  }}
                                  className="w-full text-sm font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 outline-none focus:border-teal-500 transition-colors"
                                />
                              </div>
                              <div className="text-right">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Comissão Padrão</label>
                                <div className="flex items-center justify-end gap-1">
                                  <input 
                                    type="number"
                                    defaultValue={pro.defaultCommission}
                                    onBlur={async (e) => {
                                      const newVal = parseFloat(e.target.value);
                                      if (isNaN(newVal) || newVal === pro.defaultCommission) return;
                                      try {
                                        await updateDoc(doc(db, 'professionals', pro.id), { defaultCommission: newVal });
                                      } catch (err) {
                                        handleFirestoreError(err, OperationType.UPDATE, `professionals/${pro.id}`);
                                      }
                                    }}
                                    className="w-12 text-sm text-right text-teal-600 font-mono font-bold bg-transparent border-b border-transparent hover:border-slate-200 outline-none focus:border-teal-500 transition-colors"
                                  />
                                  <span className="text-xs text-teal-600 font-bold">%</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => deleteProfessional(pro.id)} className="text-slate-300 hover:text-red-500">
                              <Trash2 size={16} />
                            </Button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                               <Mail size={14} />
                             </div>
                             <div className="flex-1">
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">E-mail de Acesso (Google)</p>
                               <input 
                                 type="email"
                                 defaultValue={pro.email || ''}
                                 placeholder="Não vinculado"
                                 onBlur={async (e) => {
                                   const newEmail = e.target.value.trim().toLowerCase();
                                   if (newEmail === (pro.email || '')) return;
                                   try {
                                     await updateDoc(doc(db, 'professionals', pro.id), { email: newEmail });
                                   } catch (err) {
                                     handleFirestoreError(err, OperationType.UPDATE, `professionals/${pro.id}`);
                                   }
                                 }}
                                 className="text-xs text-slate-600 bg-transparent border-none outline-none w-full focus:text-teal-600 font-medium"
                               />
                             </div>
                          </div>
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
                <span className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                  {userRole === 'admin' ? 'Faturamento Bruto (Mês)' : 'Comissões Brutas (Mês)'}
                </span>
                <div className="mt-2">
                  <p className="text-3xl font-bold font-mono">
                    {formatCurrency(
                      paidCommands
                        .filter(c => {
                          const date = c.date?.toDate ? c.date.toDate() : new Date();
                          const now = new Date();
                          return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                        })
                        .reduce((acc, c) => {
                          if (userRole === 'admin') return acc + (c.total || 0);
                          const profComm = c.services
                            .filter(s => s.professionalId === loggedProfessionalId)
                            .reduce((sum, s) => sum + (s.commissionValue || 0), 0);
                          return acc + profComm;
                        }, 0)
                    )}
                  </p>
                  <p className="text-xs text-teal-100 mt-1 font-medium">
                    {userRole === 'admin' ? 'Soma de todas as comandas pagas' : 'Minhas comissões acumuladas'}
                  </p>
                </div>
              </Card>

              {userRole === 'admin' && (
                <Card className="p-6 bg-slate-900 text-white border-none shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Activity size={80} />
                  </div>
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Lucro Empresa (Líquido Mês)</span>
                  <div className="mt-2">
                    <p className="text-3xl font-bold text-white font-mono">
                      {formatCurrency(calculateCompanyProfit(paidCommands.filter(c => {
                        const date = c.date?.toDate ? c.date.toDate() : new Date();
                        const now = new Date();
                        return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
                      })))}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Pós comissões e taxas</p>
                  </div>
                </Card>
              )}

              {userRole !== 'admin' && (
                <Card className="p-6 bg-slate-900 text-white border-none shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <CreditCard size={80} />
                  </div>
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Meu Saldo Atual</span>
                  <div className="mt-2">
                    <p className="text-3xl font-bold text-white font-mono">
                      {(() => {
                        const totalComm = paidCommands.reduce((acc, c) => {
                          return acc + c.services
                            .filter(s => s.professionalId === loggedProfessionalId)
                            .reduce((sum, s) => sum + (s.commissionValue || 0), 0);
                        }, 0);
                        const totalPaid = professionalTransactions
                          .filter(t => t.professionalId === loggedProfessionalId)
                          .reduce((acc, t) => acc + t.amount, 0);
                        return formatCurrency(totalComm - totalPaid);
                      })()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Líquido a receber</p>
                  </div>
                </Card>
              )}

              {userRole === 'admin' && (
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
              )}

              {userRole === 'admin' && (
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
              )}
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
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold", userRole === 'admin' ? "bg-slate-100 text-slate-400" : "bg-teal-50 text-teal-600")}>
                            {getClientDisplayName(c.clientName).charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{getClientDisplayName(c.clientName)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{c.paymentMethod}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(c.total)}</p>
                          {userRole === 'admin' && (
                            <p className="text-[9px] text-teal-600 font-bold uppercase">Empresa: {formatCurrency((c.netTotal || c.total) - c.services.reduce((acc, s) => acc + (s.commissionValue || 0), 0))}</p>
                          )}
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

                {userRole === 'admin' && (
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
                )}
              </div>

              {userRole === 'admin' && (
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
              )}

              {userRole === 'admin' && (
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
              )}
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
                <div className="space-y-2">
                  {professionals
                    .filter(p => userRole === 'admin' || p.id === loggedProfessionalId)
                    .map(pro => {
                      const totalComm = commands
                        .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === pro.id))
                        .reduce((acc, c) => acc + c.services
                          .filter(s => s.professionalId === pro.id)
                          .reduce((sum, s) => sum + (s.commissionValue || 0), 0), 0
                        );
                      const paidTransactions = professionalTransactions
                        .filter(t => t.professionalId === pro.id && t.type === 'payment')
                        .reduce((acc, t) => acc + t.amount, 0);
                      const advances = professionalTransactions
                        .filter(t => t.professionalId === pro.id && t.type === 'advance')
                        .reduce((acc, t) => acc + t.amount, 0);
                      const balance = totalComm - paidTransactions - advances;

                      return (
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-400 bg-slate-50" style={selectedProfessionalId === pro.id ? { backgroundColor: pro.color, color: '#fff' } : {}}>
                                {pro.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-slate-700">{pro.name}</p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Main: History and Commissions */}
              <div className="md:col-span-3 space-y-8">
                {selectedProfessionalId ? (
                  <>
                    <h3 className="text-2xl font-bold text-slate-800">{professionals.find(p => p.id === selectedProfessionalId)?.name}</h3>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {userRole === 'admin' && (
                        <Card className="p-6 bg-slate-900 border-none shadow-xl">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Total de Atendimentos</span>
                          <div className="flex justify-between items-end mt-2">
                             <p className="text-3xl font-bold text-white font-mono">
                               {commands.filter(c => c.services.some(s => s.professionalId === selectedProfessionalId)).length}
                             </p>
                             <div className="flex gap-2">
                               <Button 
                                 onClick={() => {
                                   const content = document.getElementById('professional-history-print');
                                   const printWindow = window.open('', '_blank');
                                   if (printWindow && content) {
                                     printWindow.document.write(`<html><head><title>Fechamento Mensal</title><style>body{font-family:sans-serif;padding:20px;}.font-mono{font-family:monospace;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #eee;padding:8px;text-align:left;}.no-print{display:none !important;}.only-print{display:inline-block !important;}</style></head><body>${content.innerHTML}</body></html>`);
                                     printWindow.document.close();
                                     printWindow.print();
                                   }
                                 }}
                                 className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-3 py-1 h-auto"
                               >
                                 Imprimir Fechamento
                               </Button>
                               <Users size={20} className="text-teal-400 mb-1" />
                             </div>
                          </div>
                        </Card>
                      )}
                      
                      <Card className={cn("p-6 border-none shadow-xl", userRole === 'admin' ? "bg-teal-600" : "bg-slate-900 col-span-2")}>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Saldo de Comissões</span>
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
                        <div className="flex justify-between items-center mt-4">
                           {userRole !== 'admin' && (
                             <Button 
                               onClick={() => {
                                 const content = document.getElementById('professional-history-print');
                                 const printWindow = window.open('', '_blank');
                                 if (printWindow && content) {
                                   printWindow.document.write(`<html><head><title>Fechamento Mensal</title><style>body{font-family:sans-serif;padding:20px;}.font-mono{font-family:monospace;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #eee;padding:8px;text-align:left;}.no-print{display:none !important;}.only-print{display:inline-block !important;}</style></head><body>${content.innerHTML}</body></html>`);
                                   printWindow.document.close();
                                   printWindow.print();
                                 }
                               }}
                               className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-3 py-1 h-auto"
                             >
                               Imprimir Meu Extrato
                             </Button>
                           )}
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
                        {userRole === 'admin' ? (
                          <>
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
                          </>
                        ) : (
                          <div className="text-center py-2 space-y-1">
                            <p className="text-[10px] text-slate-400 italic">Somente administradores podem registrar vales ou pagamentos.</p>
                          </div>
                        )}
                      </Card>
                    </div>

                    {/* Detailed History */}
                    <div id="professional-history-print" className="space-y-8">
                      {/* Printable Header */}
                      <div className="hidden only-print w-full border-b-2 border-slate-900 pb-6 mb-8 text-center bg-white">
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">
                          {settings?.clinicName || 'Registro de Atendimentos'}
                        </h1>
                        <div className="flex justify-center items-center gap-6 text-sm font-bold text-slate-500 uppercase tracking-widest">
                          <span>Profissional: {selectedProf?.name}</span>
                          <span>•</span>
                          <span>Data: {new Date().toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Spreadsheet Table (Only Print) */}
                      <div className="hidden only-print w-full mt-4">
                        <table className="w-full border-collapse border border-slate-300 text-[11px]">
                          <thead>
                            <tr className="bg-slate-100 uppercase tracking-tighter">
                              <th className="border border-slate-300 p-3 text-left">Cliente</th>
                              <th className="border border-slate-300 p-3 text-left">Serviço Realizado</th>
                              <th className="border border-slate-300 p-3 text-right">Comissão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {commands
                              .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === selectedProfessionalId))
                              .sort((a, b) => (b.date?.toDate?.()?.getTime() || 0) - (a.date?.toDate?.()?.getTime() || 0))
                              .map(command => {
                                const proServices = command.services.filter(s => s.professionalId === selectedProfessionalId);
                                const totalCommission = proServices.reduce((sum, s) => sum + (s.commissionValue || 0), 0);
                                return (
                                  <tr key={command.id} className="hover:bg-slate-50">
                                    <td className="border border-slate-300 p-3 font-bold">
                                      {command.clientName?.split(' ')[0]}
                                    </td>
                                    <td className="border border-slate-300 p-3 italic">
                                      {proServices.map(s => s.name).join(', ')}
                                    </td>
                                    <td className="border border-slate-300 p-3 text-right font-mono font-bold">
                                      {formatCurrency(totalCommission)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 font-black">
                              <td colSpan={2} className="border border-slate-300 p-3 text-right uppercase">Total de Comissões</td>
                              <td className="border border-slate-300 p-3 text-right text-teal-600">
                                {formatCurrency(
                                  commands
                                    .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === selectedProfessionalId))
                                    .reduce((acc, c) => acc + c.services
                                      .filter(s => s.professionalId === selectedProfessionalId)
                                      .reduce((sum, s) => sum + (s.commissionValue || 0), 0), 0
                                    )
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <DollarSign size={20} className="text-teal-600" /> Rendimentos e Atendimentos
                      </h3>
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
                                    <p className="font-bold text-slate-800">
                                      {getClientDisplayName(command.clientName)}
                                    </p>
                                    <span className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                                      command.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                    )}>
                                      {command.status === 'paid' ? 'Pago' : 'Pendente'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-medium">
                                    <span>{formatDate(command.date?.toDate())}</span>
                                    {command.status === 'paid' && command.closedAt && (
                                      <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded leading-none">
                                        <Clock size={10} /> {command.closedAt.toDate ? command.closedAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date(command.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                    <span>•</span>
                                    <span className="text-slate-600 font-bold">{proServices.map(s => s.name).join(', ')}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-right flex-wrap justify-end">
                                  <div className="px-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Procedimento</p>
                                    <p className="font-bold text-slate-600 text-xs">{formatCurrency(proServices.reduce((sum, s) => sum + s.price, 0))}</p>
                                  </div>
                                  <div className="border-l border-slate-100 px-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Líquido</p>
                                    <p className="font-bold text-slate-700 text-xs text-center">
                                      {formatCurrency(proServices.reduce((sum, s) => {
                                        if (s.netPrice !== undefined) return sum + s.netPrice;
                                        const feePercent = getFeePercent(command);
                                        const net = s.price - (s.price * (feePercent / 100));
                                        return sum + net;
                                      }, 0))}
                                    </p>
                                  </div>
                                  <div className="border-l border-emerald-100 pl-4 bg-emerald-50/30 py-2 rounded-xl">
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1">Comissão</p>
                                    <p className="text-lg font-black text-emerald-600 font-mono italic leading-none">{formatCurrency(totalCommission)}</p>
                                  </div>
                                  {userRole === 'admin' && (
                                    <Button variant="outline" size="sm" onClick={() => setEditingCommand(command)} className="text-slate-500 hover:text-teal-600 border-slate-100 rounded-xl h-9">
                                      <RotateCcw size={14} className="mr-1.5" /> Editar
                                    </Button>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                      </div>
                    </div>

                      <div className="space-y-4 no-print">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <CreditCard size={20} className="text-slate-600" /> Movimentações Financeiras
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {professionalTransactions
                            .filter(t => t.professionalId === selectedProfessionalId)
                            .map(t => (
                              <div key={t.id} className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm group">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    t.type === 'advance' ? "bg-orange-50 text-orange-600" : 
                                    t.type === 'commission' ? "bg-teal-50 text-teal-600" :
                                    "bg-emerald-50 text-emerald-600"
                                  )}>
                                    {t.type === 'advance' ? <RotateCcw size={16} /> : 
                                     t.type === 'commission' ? <Zap size={16} /> :
                                     <DollarSign size={16} />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-700">
                                      {t.type === 'advance' ? 'Vale' : 
                                       t.type === 'commission' ? 'Comissão Recebida' : 
                                       'Pagamento Efetuado'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">{formatDate(t.date?.toDate())}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {t.type === 'payment' && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2 text-slate-400 hover:text-teal-600"
                                      onClick={() => {
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                          printWindow.document.write(`
                                            <html>
                                              <head>
                                                <title>Comprovante de Pagamento</title>
                                                <style>
                                                  body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                                                  .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #e2e8f0; padding: 40px; border-radius: 12px; }
                                                  .header { text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
                                                  .title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; margin: 0; }
                                                  .subtitle { font-size: 14px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px; }
                                                  .content { margin-bottom: 40px; }
                                                  .row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 8px; }
                                                  .label { font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; }
                                                  .value { font-weight: 800; color: #0f172a; }
                                                  .amount-box { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px; border: 1px solid #e2e8f0; }
                                                  .amount-label { font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
                                                  .amount-value { font-size: 32px; font-weight: 900; color: #0d9488; }
                                                  .footer { margin-top: 60px; text-align: center; }
                                                  .signature { border-top: 1px solid #e2e8f0; width: 250px; margin: 0 auto; padding-top: 8px; font-size: 12px; color: #64748b; font-weight: 700; margin-top: 40px; }
                                                  @media print { body { padding: 0; } .receipt { border: none; padding: 0; margin: 0; max-width: 100%; } }
                                                </style>
                                              </head>
                                              <body>
                                                <div class="receipt">
                                                  <div class="header">
                                                    <h1 class="title">${settings?.clinicName || 'Registro de Atendimentos'}</h1>
                                                    <div class="subtitle">Comprovante de Pagamento Profissional</div>
                                                  </div>
                                                  <div class="content">
                                                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                                                      <div>
                                                        <div class="label">Profissional</div>
                                                        <div class="value">${selectedProf?.name}</div>
                                                      </div>
                                                      <div style="text-align: right">
                                                        <div class="label">Data de Emissão</div>
                                                        <div class="value">${new Date().toLocaleDateString('pt-BR')}</div>
                                                      </div>
                                                    </div>
                                                    <div class="row">
                                                      <span class="label">Descrição</span>
                                                      <span class="value">Pagamento de Comissões Acumuladas</span>
                                                    </div>
                                                    <div class="row">
                                                      <span class="label">Data do Pagamento</span>
                                                      <span class="value">${formatDate(t.date?.toDate())}</span>
                                                    </div>
                                                    ${t.notes ? `
                                                    <div class="row">
                                                      <span class="label">Observações</span>
                                                      <span class="value">${t.notes}</span>
                                                    </div>` : ''}
                                                  </div>
                                                  <div class="amount-box">
                                                    <div class="amount-label">Valor Total Pago</div>
                                                    <div class="amount-value">${formatCurrency(t.amount)}</div>
                                                  </div>
                                                  <div class="footer">
                                                    <div class="signature">Assinado: ${settings?.clinicName || 'A Administração'}</div>
                                                    <div style="margin-top: 20px; font-size: 10px; color: #cbd5e1; font-weight: 600;">Este documento é um comprovante interno gerado pelo sistema.</div>
                                                  </div>
                                                </div>
                                              </body>
                                            </html>
                                          `);
                                          printWindow.document.close();
                                          printWindow.print();
                                        }
                                      }}
                                    >
                                      <Printer size={16} />
                                    </Button>
                                  )}
                                  
                                  <div className="text-right">
                                    <p className={cn(
                                      "text-sm font-bold font-mono", 
                                      t.type === 'advance' ? "text-orange-600" : 
                                      t.type === 'commission' ? "text-teal-600" :
                                      "text-emerald-600"
                                    )}>
                                      {t.type === 'advance' ? '-' : t.type === 'commission' ? '+' : ''}{formatCurrency(t.amount)}
                                    </p>
                                    <div className="flex gap-2 justify-end mt-1">
                                      {t.notes && <p className="text-[9px] text-slate-400 italic max-w-[100px] truncate">{t.notes}</p>}
                                      {userRole === 'admin' && (
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
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-4 bg-slate-50/30 rounded-3xl border border-slate-100">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-2">
                       <Briefcase size={32} />
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
                      <LucideUser className="text-teal-600" size={24} />
                      <h3 className="text-lg font-bold">Administradores Adicionais</h3>
                    </div>
                    <p className="text-sm text-slate-500">
                      Adicione emails (separados por vírgula) que também possuem acesso total administrativo ao sistema.
                    </p>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const emailsStr = formData.get('adminEmails') as string;
                      const adminEmails = emailsStr.split(',').map(e => e.trim()).filter(e => e.length > 5);
                      saveSettings({ ...settings, adminEmails });
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emails dos Administradores</label>
                        <Input 
                          name="adminEmails" 
                          defaultValue={settings?.adminEmails?.join(', ') || ''} 
                          placeholder="email1@exemplo.com, email2@exemplo.com" 
                        />
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Atualizar Administradores
                      </Button>
                    </form>
                  </Card>

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
                      fees.debitVisaMaster = parseFloat(formData.get('debitVisaMaster') as string) || 0;
                      fees.debitEloAmex = parseFloat(formData.get('debitEloAmex') as string) || 0;
                      saveSettings({ ...settings, fees });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visa / Master (%)</label>
                          <Input 
                            name="debitVisaMaster" 
                            type="number" 
                            step="0.01"
                            defaultValue={settings?.fees?.debitVisaMaster || settings?.fees?.debit || 0} 
                            placeholder="Ex: 1.99" 
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Elo / Amex (%)</label>
                          <Input 
                            name="debitEloAmex" 
                            type="number" 
                            step="0.01"
                            defaultValue={settings?.fees?.debitEloAmex || settings?.fees?.debit || 0} 
                            placeholder="Ex: 2.10" 
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11">
                        Salvar Taxas Débito
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
                                {loc.mapsUrl && (
                                  <a href={loc.mapsUrl} target="_blank" rel="noreferrer" className="text-[10px] text-teal-600 hover:underline flex items-center gap-1 mt-1">
                                    <ExternalLink size={10} /> Link do Maps
                                  </a>
                                )}
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

          {activeTab === 'birthdays' && !isImportingClients && (
          <motion.div 
            key="birthdays"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Aniversariantes</h2>
                <p className="text-gray-500 mt-1">Celebre com seus clientes e ofereça mimos especiais.</p>
              </div>
              <Button 
                onClick={() => setIsImportingClients(true)} 
                className="gap-2 bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-500/20"
              >
                <UploadCloud size={18} /> Importar
              </Button>
            </header>

            {birthdayClientsToday.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-rose-500">
                  <LucideUser size={20} /> Hoje ({birthdayClientsToday.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {birthdayClientsToday.map(client => {
                    const sent = wasMessageSentThisYear(client);
                    const isNew = isNewClientThisMonth(client);
                    return (
                      <Card key={client.id} className={cn("p-6 border-rose-100 relative overflow-hidden group transition-all", sent ? "bg-slate-50/50 grayscale-[0.5]" : "bg-rose-50/20 shadow-sm")}>
                        {isNew && !sent && (
                          <div className="absolute top-2 left-2 bg-rose-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 animate-bounce">
                            NOVO CLIENTE
                          </div>
                        )}
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <LucideUser size={80} className="text-rose-500" />
                        </div>
                        <div className="space-y-4 relative z-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-lg text-slate-800">{client.name}</p>
                              <p className="text-xs text-rose-400 font-bold uppercase">Faz anos hoje!</p>
                            </div>
                            {sent && (
                              <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full" title="Mensagem enviada">
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                          </div>
                          {!sent ? (
                            <Button 
                              onClick={() => {
                                const msg = `Olá ${client.name.split(' ')[0]}, já estamos em clima de festa! No mês do seu aniversário você tem 10% de desconto em qualquer procedimento na Raras Clinic!`;
                                window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                markBirthdaySent(client.id);
                              }}
                              className="w-full bg-rose-500 hover:bg-rose-600 gap-2"
                            >
                              <MessageCircle size={16} /> Enviar Parabéns (10% OFF)
                            </Button>
                          ) : (
                            <div className="text-center py-2 bg-white/50 rounded-lg border border-emerald-100 text-[10px] text-emerald-600 font-bold uppercase">
                              Parabéns enviado 👍
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
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
                  {birthdayClientsMonth.map(client => {
                    const sent = wasMessageSentThisYear(client);
                    const isNew = isNewClientThisMonth(client);
                    return (
                      <Card key={client.id} className={cn("p-5 hover:border-teal-200 transition-all cursor-pointer group relative", sent && "opacity-60 bg-slate-50/30")} onClick={() => setSelectedClient(client)}>
                        {isNew && !sent && (
                          <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">
                            NOVO
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 bg-slate-50 rounded-xl flex flex-col items-center justify-center font-bold transition-colors", sent ? "text-slate-300" : "text-slate-400 group-hover:bg-teal-500 group-hover:text-white")}>
                            <span className="text-[10px] uppercase">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(client.birthDate + 'T12:00:00'))}</span>
                            <span className="text-sm">{client.birthDate.split('-')[2]}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm text-slate-700">{client.name}</p>
                              {sent && <CheckCircle2 size={14} className="text-emerald-500" />}
                            </div>
                            <p className="text-xs text-slate-400">{client.phone}</p>
                          </div>
                          {!sent && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                const msg = `Olá ${client.name.split(' ')[0]}, já estamos em clima de festa! No mês do seu aniversário você tem 10% de desconto em qualquer procedimento na Raras Clinic!`;
                                window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                markBirthdaySent(client.id);
                              }}
                              className="text-teal-600 hover:bg-teal-50"
                            >
                              <MessageCircle size={18} />
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
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
              <p className="text-gray-500 mt-1">Recupere ou exclua permanentemente itens removidos.</p>
            </header>

            <div className="space-y-8">
              {/* Clients Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <LucideUser size={20} className="text-slate-400" /> Clientes Removidos
                </h3>
                {deletedClients.length === 0 ? (
                  <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200">
                    <p className="font-bold uppercase tracking-widest text-xs">Nenhum cliente na lixeira</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deletedClients.map(client => (
                      <Card key={client.id} className="p-6 flex flex-col justify-between gap-4 border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800">{client.name}</p>
                          <p className="text-xs text-slate-400">{client.phone}</p>
                          {client.deletedAt && (
                            <p className="text-[10px] text-slate-400 mt-2 italic">
                              Excluído em: {formatDate(client.deletedAt?.toDate ? client.deletedAt.toDate() : new Date(client.deletedAt))}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => restoreClient(client.id)}
                            className="flex-1 gap-2 text-teal-600 border-teal-100 hover:bg-teal-50"
                          >
                            <RotateCcw size={16} /> Restaurar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => permanentDeleteClient(client.id)}
                            className="text-red-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Anamnesis Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText size={20} className="text-slate-400" /> Fichas de Anamnese
                </h3>
                {deletedAnamnesis.length === 0 ? (
                  <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200">
                    <p className="font-bold uppercase tracking-widest text-xs">Nenhuma ficha na lixeira</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {deletedAnamnesis.map(anam => {
                      const client = clients.find(c => c.id === anam.id) || deletedClients.find(c => c.id === anam.id);
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
                                Excluída em: {formatDate(anam.deletedAt?.toDate ? anam.deletedAt.toDate() : new Date(anam.deletedAt)) || 'Data desconhecida'}
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
            </div>
          </motion.div>
        )}

          {/* Feedbacks View */}
          {activeTab === ('feedbacks' as any) && (
            <motion.div 
              key="feedbacks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Avaliações dos Clientes</h2>
                <p className="text-gray-500 mt-1">Veja o que seus clientes estão dizendo sobre o atendimento.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedbacks.length === 0 ? (
                  <Card className="col-span-full p-20 text-center flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200">
                    <Star size={48} strokeWidth={1} />
                    <p className="font-bold uppercase tracking-widest text-xs">Nenhuma avaliação recebida ainda</p>
                  </Card>
                ) : (
                  feedbacks.map(fb => (
                    <Card key={fb.id} className="p-6 space-y-4 border-slate-100 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-800">{fb.clientName}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                              Atendido por: {fb.professionalName}
                            </p>
                          </div>
                          <div className="flex bg-amber-50 px-2 py-1 rounded-lg gap-1 items-center">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            <span className="text-xs font-black text-amber-600">{fb.rating}</span>
                          </div>
                        </div>
                        {fb.comment && (
                          <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                            "{fb.comment}"
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          {formatDate(fb.createdAt)}
                        </p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={async () => {
                            if (confirm('Excluir esta avaliação?')) {
                              try { await deleteDoc(doc(db, 'feedbacks', fb.id)); }
                              catch (err) { handleFirestoreError(err, OperationType.DELETE, `feedbacks/${fb.id}`); }
                            }
                          }}
                          className="text-slate-300 hover:text-red-500 h-8 w-8 p-0"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Card>
                  ))
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
              className="max-w-4xl mx-auto space-y-8"
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
          {selectedClient && userRole === 'admin' && (
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
                  { id: 'registration', label: 'Cadastro', icon: LucideUser },
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
                {clientSection === 'registration' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-bold">Informações Cadastrais</h3>
                      <p className="text-sm text-slate-500">Gerencie os dados e o perfil do cliente.</p>
                    </header>
                    <Card className="p-8 border-slate-100 shadow-sm">
                      <ClientForm client={selectedClient} onSuccess={() => {
                        // Refresh selected client if needed or just show success
                        // Actually, the form updates Firestore, which triggers onSnapshot in App.tsx
                        // The selectedClient state might be stale though if it's from local state
                         alert('Cadastro atualizado com sucesso!');
                      }} />
                    </Card>
                  </div>
                )}

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
                                         const location = locations.find(l => l.id === a.locationId);
                                         let locSuffix = '';
                                         if (location) {
                                           locSuffix = ` na Unidade ${location.name}`;
                                           if (location.mapsUrl) {
                                             locSuffix += ` (${location.mapsUrl})`;
                                           }
                                         }
                                         const msg = `Olá ${a.clientName.split(' ')[0]}, Podemos Confirmar seu horário ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(a.date)}, as ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(a.date)}h${locSuffix}?`;
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
                                         const location = locations.find(l => l.id === a.locationId);
                                         let locInfo = '';
                                         if (location) {
                                           locInfo = `\n\n📍 *Unidade ${location.name}:* ${location.address || ''}`;
                                           if (location.mapsUrl) {
                                             locInfo += `\n🔗 *Localização:* ${location.mapsUrl}`;
                                           }
                                         }
                                         const msg = `Seu horário foi agendado com sucesso para Dia *${dateStr} as ${timeStr}h*${locInfo}\n\n🔴Tempo de tolerância para atraso é de *5 minutos.* Após faremos um novo agendamento, \n\n🔴*Em caso de desistência ou troca de horário por gentileza avisar com 4 horas de antecedência.*\n\n💰Forma de pagamentos:credito, débito Pix. No ato do check in.\n\n🔴*Evite Trazer Acompanhantes.*\n\nSiga nosso Instagram e fique por dentro das novidades 👇🏻\n\nhttps://www.instagram.com/podologaandressakupferman/\n\n*Por favor leia as regras da empresa,para não haver constrangimentos* 👆🏻`;
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
                            key={`command-${selectedClient.id}-${pendingCommandServices.map(s => s.name).join(',')}`}
                            client={selectedClient} 
                            initialServices={pendingCommandServices}
                            appointmentId={pendingAppointmentId}
                            onSuccess={() => {
                              setPendingCommandServices([]);
                              setPendingAppointmentId(null);
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
              balance={(() => {
                const proId = transactionModal.professionalId;
                const totalComm = commands
                  .filter(c => c.status === 'paid' && c.services.some(s => s.professionalId === proId))
                  .reduce((acc, c) => acc + c.services
                    .filter(s => s.professionalId === proId)
                    .reduce((sum, s) => sum + (s.commissionValue || 0), 0), 0
                  );
                const paidTransactions = professionalTransactions
                  .filter(t => t.professionalId === proId && t.type === 'payment')
                  .reduce((acc, t) => acc + t.amount, 0);
                const advances = professionalTransactions
                  .filter(t => t.professionalId === proId && t.type === 'advance')
                  .reduce((acc, t) => acc + t.amount, 0);
                return totalComm - paidTransactions - advances;
              })()}
              onSuccess={() => {
                setTransactionModal(null);
                alert('Transação registrada com sucesso!');
              }}
            />
          </div>
        )}
      </Modal>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <Card className="p-8 flex flex-col items-center gap-4 max-w-sm mx-4 bg-white shadow-2xl border-none">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
            <div className="text-center">
              <h3 className="font-bold text-lg text-slate-800">Processando...</h3>
              <p className="text-slate-500 text-sm mt-1">Por favor, aguarde enquanto realizamos as alterações na base de dados.</p>
            </div>
          </Card>
        </div>
      )}
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

