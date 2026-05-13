import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  query, 
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client } from '../types';
import { 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Merge
} from 'lucide-react';
import { Button, Card } from './ui';

interface DuplicateGroup {
  key: string;
  type: 'name' | 'phone';
  clients: Client[];
}

export function ClientMerger({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [stats, setStats] = useState({ total: 0, groups: 0 });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'clients'));
      const clientsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setAllClients(clientsData);
      findDuplicates(clientsData);
    } catch (err) {
      console.error("Error loading clients for merge:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (p: string) => {
    if (!p) return '';
    return p.replace(/\D/g, '').replace(/^55/, '');
  };

  const normalizeName = (n: string) => {
    if (!n) return '';
    return n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const findDuplicates = (clients: Client[]) => {
    const groups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    // 1. Group by Name
    const nameMap = new Map<string, Client[]>();
    clients.forEach(c => {
      const key = normalizeName(c.name);
      if (key && key.length > 3) {
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key)!.push(c);
      }
    });

    nameMap.forEach((group, key) => {
      if (group.length > 1) {
        groups.push({ key, type: 'name', clients: group });
        group.forEach(c => processedIds.add(c.id));
      }
    });

    // 2. Group by Phone (only those not already in groups to avoid overlap confusion, 
    // or we can allow overlap and just merge them all finally)
    const phoneMap = new Map<string, Client[]>();
    clients.forEach(c => {
      const key = normalizePhone(c.phone);
      if (key && key.length >= 8) {
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(c);
      }
    });

    phoneMap.forEach((group, key) => {
      if (group.length > 1) {
        // Only add if not already fully contained in an existing name group
        // To keep it simple, we add all phone duplicates
        groups.push({ key, type: 'phone', clients: group });
      }
    });

    // Filter out groups that are subsets of others or have high overlap
    // For now, let's just show them and let user decide or merge incrementally

    setDuplicateGroups(groups);
    setStats({ total: clients.length, groups: groups.length });
    setSelectedGroups(groups.map((_, i) => i)); // Select all by default
  };

  const mergeAllSelected = async () => {
    if (!confirm(`Deseja mesclar os ${selectedGroups.length} grupos selecionados? Esta ação atualizará todos os agendamentos, comandos e anamneses relacionados.`)) return;

    setMerging(true);
    let mergedCount = 0;

    try {
      for (const groupIndex of selectedGroups) {
        const group = duplicateGroups[groupIndex];
        // Sort clients by creation date or info completeness
        // We'll pick the one with most info as survivor
        const sorted = [...group.clients].sort((a, b) => {
          const aWeight = (a.cpf ? 1 : 0) + (a.email ? 1 : 0) + (a.birthDate ? 1 : 0);
          const bWeight = (b.cpf ? 1 : 0) + (b.email ? 1 : 0) + (b.birthDate ? 1 : 0);
          return bWeight - aWeight;
        });

        const survivor = sorted[0];
        const duplicates = sorted.slice(1);

        for (const duplicate of duplicates) {
          await mergeTwoClients(survivor, duplicate);
        }
        mergedCount++;
      }
      alert(`Sucesso! ${mergedCount} grupos foram mesclados.`);
      onComplete();
    } catch (err) {
      console.error("Error during merge process:", err);
      alert("Ocorreu um erro durante a mesclagem. Verifique o console.");
    } finally {
      setMerging(false);
    }
  };

  const mergeTwoClients = async (survivor: Client, duplicate: Client) => {
    // 1. Update Appointments
    const appointmentsQuery = query(collection(db, 'appointments'), where('clientId', '==', duplicate.id));
    const appointmentsSnap = await getDocs(appointmentsQuery);
    
    // 2. Update Commands
    const commandsQuery = query(collection(db, 'commands'), where('clientId', '==', duplicate.id));
    const commandsSnap = await getDocs(commandsQuery);

    // 3. Update Anamnesis
    const anamnesisQuery = query(collection(db, 'anamnesis'), where('clientId', '==', duplicate.id));
    const anamnesisSnap = await getDocs(anamnesisQuery);
    
    // 4. Update Feedbacks
    const feedbackQuery = query(collection(db, 'feedbacks'), where('clientId', '==', duplicate.id));
    const feedbackSnap = await getDocs(feedbackQuery);

    const batch = writeBatch(db);

    // Update survivor with missing data from duplicate if survivor doesn't have it
    const updates: any = {};
    if (!survivor.email && duplicate.email) updates.email = duplicate.email;
    if (!survivor.birthDate && duplicate.birthDate) updates.birthDate = duplicate.birthDate;
    if (!survivor.address && duplicate.address) updates.address = duplicate.address;
    if (!survivor.cpf && duplicate.cpf) updates.cpf = duplicate.cpf;
    if (!survivor.rg && duplicate.rg) updates.rg = duplicate.rg;
    if (!survivor.cep && duplicate.cep) updates.cep = duplicate.cep;
    if (!survivor.city && duplicate.city) updates.city = duplicate.city;
    if (!survivor.state && duplicate.state) updates.state = duplicate.state;
    if (!survivor.neighborhood && duplicate.neighborhood) updates.neighborhood = duplicate.neighborhood;
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc(db, 'clients', survivor.id), { ...updates, updatedAt: serverTimestamp() });
    }

    appointmentsSnap.docs.forEach(d => {
      batch.update(doc(db, 'appointments', d.id), { clientId: survivor.id, clientName: survivor.name });
    });

    commandsSnap.docs.forEach(d => {
      batch.update(doc(db, 'commands', d.id), { clientId: survivor.id, clientName: survivor.name });
    });

    anamnesisSnap.docs.forEach(d => {
      batch.update(doc(db, 'anamnesis', d.id), { clientId: survivor.id });
    });

    feedbackSnap.docs.forEach(d => {
      batch.update(doc(db, 'feedbacks', d.id), { clientId: survivor.id, clientName: survivor.name });
    });

    // Subcollection Evolution
    const evolutionSnap = await getDocs(collection(db, 'clients', duplicate.id, 'evolution'));
    evolutionSnap.docs.forEach(d => {
      // Need to create new doc in survivor and delete from duplicate
      // Batch doesn't support subcollection moving easily because we need auto-IDs or same IDs
      const newEvolutionRef = doc(collection(db, 'clients', survivor.id, 'evolution'));
      batch.set(newEvolutionRef, { ...d.data(), updatedAt: serverTimestamp() });
      batch.delete(doc(db, 'clients', duplicate.id, 'evolution', d.id));
    });

    // Delete duplicate client
    batch.delete(doc(db, 'clients', duplicate.id));

    await batch.commit();
  };

  if (loading) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-teal-600" size={40} />
        <p className="text-slate-500 font-medium">Analisando base de dados em busca de duplicados...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Mesclar Clientes Duplicados</h2>
          <p className="text-slate-500 text-sm">
            Encontramos {duplicateGroups.length} possíveis grupos de duplicados entre {stats.total} clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={merging}>Cancelar</Button>
          <Button 
            className="bg-teal-600 hover:bg-teal-700 gap-2" 
            onClick={mergeAllSelected}
            disabled={merging || selectedGroups.length === 0}
          >
            {merging ? <Loader2 className="animate-spin" size={18} /> : <Merge size={18} />}
            Mesclar Selecionados ({selectedGroups.length})
          </Button>
        </div>
      </header>

      {duplicateGroups.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 border-dashed border-2 border-slate-200">
          <CheckCircle2 className="text-teal-500" size={48} />
          <div>
            <h3 className="font-bold text-slate-800">Tudo limpo!</h3>
            <p className="text-slate-500 max-w-md">Não encontramos nenhum cliente com nome ou telefone exatamente igual na sua base de dados.</p>
          </div>
          <Button variant="outline" onClick={onCancel}>Voltar para Clientes</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
          {duplicateGroups.map((group, idx) => (
            <Card key={idx} className={cn(
              "p-4 border-l-4 transition-all",
              selectedGroups.includes(idx) ? "border-l-teal-500 bg-teal-50/20" : "border-l-slate-200"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      group.type === 'name' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {group.type === 'name' ? 'Nome Repetido' : 'Telefone Repetido'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Chave: <span className="text-slate-700">{group.key}</span>
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-white border border-slate-100 rounded-xl">
                        <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-tighter">Sobrevivente (Mais info)</p>
                        <p className="font-bold text-slate-800">{group.clients[0].name}</p>
                        <p className="text-xs text-slate-500">{group.clients[0].phone}</p>
                      </div>
                      <ArrowRight className="text-slate-300" size={20} />
                      <div className="flex-1 space-y-2">
                        {group.clients.slice(1).map((c, ci) => (
                          <div key={ci} className="p-3 bg-slate-50 border border-slate-100 rounded-xl opacity-70">
                            <p className="text-xs font-bold text-red-400 mb-1 uppercase tracking-tighter">Remover & Mesclar</p>
                            <p className="font-bold text-slate-700">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.phone}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <input 
                  type="checkbox" 
                  checked={selectedGroups.includes(idx)} 
                  onChange={(e) => {
                    if (e.target.checked) setSelectedGroups(prev => [...prev, idx]);
                    else setSelectedGroups(prev => prev.filter(i => i !== idx));
                  }}
                  className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer mt-2"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
