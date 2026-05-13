import React, { useState, useRef, useEffect } from 'react';
import { db, auth, signInAnonymously } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc, onSnapshot, query, orderBy, updateDoc, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { Input, Button } from './ui';
import { cn, formatCurrency } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Client, Anamnesis, Command, Service, Professional, RegisteredService, Appointment, ClinicBranch, AppSettings } from '../types';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  RotateCcw, 
  Camera, 
  UploadCloud, 
  X, 
  XCircle,
  User as UserIcon, 
  Briefcase,
  ClipboardList,
  Calendar,
  MessageCircle,
  Clock,
  ExternalLink,
  MapPin,
  DollarSign,
  Zap,
  UserPlus
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import * as XLSX from 'xlsx';

import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// --- Client Importer Component ---
export function ClientImporter({ onImported }: { onImported: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const parseTextWithGemini = async (text: string, type: 'clients' | 'services'): Promise<any[]> => {
    const systemInstruction = `Você é um extrator de dados estruturados. Extraia uma lista de ${type === 'clients' ? 'clientes' : 'serviços'} do texto fornecido.
    Retorne APENAS um array JSON válido.
    
    Para clientes, as chaves devem ser: Nome, Celular, Telefone, "Data de Nascimento", Email, "Endereço", CPF, RG, CEP, Estado, Cidade, Bairro.
    IMPORTANTE para "Data de Nascimento": Tente extrair no formato AAAA-MM-DD se possível. Se encontrar apenas dia e mês, use 1900 como ano padrão (ex: 1900-MM-DD).
    
    Para serviços, as chaves devem ser: Nome, "Preço Padrão", Categoria.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: `Texto para extrair:\n\n${text}` }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: type === 'clients' ? {
              Nome: { type: Type.STRING },
              Celular: { type: Type.STRING },
              Telefone: { type: Type.STRING },
              "Data de Nascimento": { type: Type.STRING },
              Email: { type: Type.STRING },
              "Endereço": { type: Type.STRING },
              CPF: { type: Type.STRING },
              RG: { type: Type.STRING },
              CEP: { type: Type.STRING },
              Estado: { type: Type.STRING },
              Cidade: { type: Type.STRING },
              Bairro: { type: Type.STRING },
            } : {
              Nome: { type: Type.STRING },
              "Preço Padrão": { type: Type.NUMBER },
              Categoria: { type: Type.STRING },
            }
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error('Erro ao parsear resposta do Gemini:', e);
      return [];
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'clients' | 'services' | 'full_history') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const findRawValue = (row: any, aliases: string[]) => {
        // Precise search first
        for (const alias of aliases) {
          if (row[alias] !== undefined && row[alias] !== null) {
            const val = row[alias];
            if (typeof val === 'string' && val.trim() === '') continue;
            return val;
          }
        }
        // Case-insensitive search second
        const lowerAliases = aliases.map(a => a.toLowerCase().trim());
        for (const key in row) {
          if (lowerAliases.includes(key.toLowerCase().trim())) {
            const val = row[key];
            if (typeof val === 'string' && val.trim() === '') continue;
            return val;
          }
        }
        return '';
      };

      const findStringValue = (row: any, aliases: string[]) => {
        const val = findRawValue(row, aliases);
        return val ? String(val).trim() : '';
      };

      const parseDateString = (val: any): string => {
        if (!val) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        
        let s = String(val).trim();
        if (!s) return '';

        // Handle YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];

        // Handle DD/MM/YYYY or DD/MM/YY
        if (s.includes('/')) {
          const parts = s.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2].trim();
            if (year.length === 2) {
              const numYear = parseInt(year);
              year = numYear > 30 ? `19${year}` : `20${year}`;
            }
            return `${year}-${month}-${day}`;
          }
          if (parts.length === 2) {
            // Assume birth year 1900 if only day/month provided
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            return `1900-${month}-${day}`;
          }
        }

        // Handle DD-MM-YYYY
        if (s.includes('-') && !s.startsWith('20') && !s.startsWith('19')) {
          const parts = s.split('-');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].trim();
            return `${year.length === 2 ? `20${year}` : year}-${month}-${day}`;
          }
        }

        return s;
      };

      let data: any[] = [];
      
      if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        const jsonText = await new Promise<string>((resolve) => {
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.readAsText(file);
        });
        data = JSON.parse(jsonText);
      } else if (file.name.endsWith('.pdf')) {
        const pdfText = await extractTextFromPDF(file);
        if (type === 'full_history') {
          setError('Importação de histórico completo não disponível para PDF. Use JSON.');
          setLoading(false);
          return;
        }
        data = await parseTextWithGemini(pdfText, type as 'clients' | 'services');
      } else {
        const reader = new FileReader();
        const bstr = await new Promise<string>((resolve) => {
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.readAsBinaryString(file);
        });
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        data = XLSX.utils.sheet_to_json(ws);
      }

      if (!Array.isArray(data)) throw new Error('Formato inválido. Deve ser um array.');

      if (type === 'clients') {
        let importedCount = 0;
        for (const row of data) {
          const name = findStringValue(row, ['Nome', 'name', 'Nome Completo', 'CLIENTE', 'Cliente', 'NOME', 'FULLNAME', 'Fullname', 'Paciente', 'PACIENTE', 'NOM', 'Usuario', 'USUARIO', 'User']);
          
          if (!name || name === 'Sem Nome') continue;

          const phone = findStringValue(row, ['Celular', 'CELULAR', 'MOBILE', 'Mobile', 'Cell', 'CELL', 'Telefone', 'TELEFONE', 'phone', 'TEL', 'Tel', 'Whatsapp', 'Contato', 'Fone', 'FONE', 'Telefone/Celular', 'Telefone / Celular', 'Celular/Telefone', 'Celular / Telefone']);
          const email = findStringValue(row, ['Email', 'email', 'EMAIL', 'Mail', 'E-mail', 'Correio']);
          let birthDateRaw = findRawValue(row, ['Data de Nascimento', 'birthDate', 'Nascimento', 'DATA NASCIMENTO', 'DATA DE NASCIMENTO', 'Aniversario', 'Birthdate', 'Birthday', 'NASCIMENTO', 'DN', 'Nasc', 'Data Nasc', 'Data de Nasc', 'Nasc.', 'Niver', 'Data de Aniversário']);
          const address = findStringValue(row, ['Endereço', 'address', 'Endereco', 'ENDEREÇO', 'Moradia', 'Logradouro', 'Rua', 'Casa', 'End']);
          let registrationDateRaw = findRawValue(row, ['Data de Registro', 'registrationDate', 'DATA DE REGISTRO', 'DATA REGISTRO', 'Registro', 'Created', 'Data', 'Data de Cadastro', 'DATA DE CADASTRO', 'Data Cadastro', 'Cadastro', 'DATACADASTRO']);
          
          const cpf = findStringValue(row, ['CPF', 'cpf', 'C.P.F']);
          const rg = findStringValue(row, ['RG', 'rg', 'R.G']);
          const cep = findStringValue(row, ['CEP', 'cep', 'C.E.P']);
          const state = findStringValue(row, ['Estado', 'state', 'UF', 'U.F']);
          const city = findStringValue(row, ['Cidade', 'city', 'Municipio']);
          const neighborhood = findStringValue(row, ['Bairro', 'neighborhood', 'Distrito']);
          
          const birthDate = parseDateString(birthDateRaw);
          const parsedRegDate = parseDateString(registrationDateRaw);
          
          let createdAtValue;
          if (registrationDateRaw instanceof Date) {
            createdAtValue = registrationDateRaw;
          } else if (parsedRegDate) {
            const dateObj = new Date(`${parsedRegDate}T12:00:00Z`);
            createdAtValue = !isNaN(dateObj.getTime()) ? dateObj : serverTimestamp();
          } else {
            createdAtValue = serverTimestamp();
          }
          
          try {
            await addDoc(collection(db, 'clients'), {
              name: name,
              phone: phone,
              email: email,
              birthDate: birthDate,
              address: address,
              cpf: cpf,
              rg: rg,
              cep: cep,
              state: state,
              city: city,
              neighborhood: neighborhood,
              createdAt: createdAtValue
            });
            importedCount++;
          } catch (err) {
            console.error('Failed to import row for client:', name, err);
          }
        }
        alert(`Sucesso! ${importedCount} clientes foram importados.`);
      } else if (type === 'services') {
        for (const row of data) {
          const name = row.Nome || row.name || row.SERVIÇO || row.Serviço || row.Procedimento || 'Sem Nome';
          const price = row['Preço Padrão'] || row.price || row.Valor || row.Preço || row.PREÇO || 0;
          const category = row.Categoria || row.category || row.CATEGORIA || 'Outros';

          await addDoc(collection(db, 'services_catalog'), {
            name: String(name).trim(),
            defaultPrice: parseFloat(String(price).replace(/[^\d.,]/g, '').replace(',', '.') || '0'),
            category: String(category).trim(),
            updatedAt: serverTimestamp()
          });
        }
      } else if (type === 'full_history') {
        for (const row of data) {
          const name = row.name || row.Nome || row['Nome Completo'] || 'Importado';
          const phone = row.phone || row.Telefone || row.Celular || '';
          const email = row.email || row.Email || '';
          const birthDate = row.birthDate || row['Data de Nascimento'] || '';
          const address = row.address || row['Endereço'] || '';

          // Create Client
          const clientRef = await addDoc(collection(db, 'clients'), {
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: String(email).trim(),
            birthDate: String(birthDate).trim(),
            address: String(address).trim(),
            createdAt: serverTimestamp()
          });

          // Import History if exists
          const history = row.history || row.historico;
          if (Array.isArray(history)) {
            for (const entry of history) {
              await addDoc(collection(db, 'clients', clientRef.id, 'evolution'), {
                clientId: clientRef.id,
                date: entry.date ? new Date(entry.date) : new Date(),
                description: entry.description || entry.descricao || '',
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }

      alert(`Importação de ${type} concluída com sucesso!`);
      onImported();
    } catch (err) {
      console.error('Erro na importação:', err);
      setError('Falha ao processar arquivo. Verifique o formato e permissões.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <UserIcon size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Importar Clientes</h4>
            <p className="text-[10px] text-slate-400">Nome, Celular, Telefone, Data de Nascimento</p>
          </div>
        </div>
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv, .pdf" 
          id="import-clients" 
          className="hidden" 
          onChange={(e) => handleFileUpload(e, 'clients')}
          disabled={loading}
        />
        <Button 
          variant="outline" 
          className="w-full text-teal-600 border-teal-100 bg-teal-50/10"
          onClick={() => document.getElementById('import-clients')?.click()}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Selecionar Arquivo'}
        </Button>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <ClipboardList size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Importar Catálogo</h4>
            <p className="text-[10px] text-slate-400">Excel (XLSX/CSV) ou PDF</p>
          </div>
        </div>
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv, .pdf" 
          id="import-services" 
          className="hidden" 
          onChange={(e) => handleFileUpload(e, 'services')}
          disabled={loading}
        />
        <Button 
          variant="outline" 
          className="w-full text-teal-600 border-teal-100 bg-teal-50/10"
          onClick={() => document.getElementById('import-services')?.click()}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Selecionar Arquivo'}
        </Button>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <RotateCcw size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Histórico Completo</h4>
            <p className="text-[10px] text-slate-400">Apenas JSON: name, phone...</p>
          </div>
        </div>
        <input 
          type="file" 
          accept=".json" 
          id="import-history" 
          className="hidden" 
          onChange={(e) => handleFileUpload(e, 'full_history')}
          disabled={loading}
        />
        <Button 
          variant="outline" 
          className="w-full text-amber-600 border-amber-100 bg-amber-50/10"
          onClick={() => document.getElementById('import-history')?.click()}
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Selecionar JSON'}
        </Button>
      </div>
      {error && <p className="text-red-500 text-xs mt-2 col-span-full">{error}</p>}
    </div>
  );
}

// --- Client Registration Form ---
export function ClientForm({ client, onSuccess }: { client?: Client, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    secondaryPhone: client?.secondaryPhone || '',
    email: client?.email || '',
    birthDate: client?.birthDate || '',
    address: client?.address || '',
    gender: client?.gender || 'Outro',
    cpf: client?.cpf || '',
    rg: client?.rg || '',
    cep: client?.cep || '',
    state: client?.state || '',
    city: client?.city || '',
    neighborhood: client?.neighborhood || '',
    avatarUrl: client?.avatarUrl || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const path = 'clients';
    try {
      if (client?.id) {
        await updateDoc(doc(db, path, client.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, path), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, client?.id ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // In a real app we'd upload to Storage. 
    // Here we'll use a local data URL as a demo if requested or just allow setting the URL.
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFormData({ ...formData, avatarUrl: evt.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Photo Section */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={48} className="text-slate-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-teal-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-teal-700 transition-colors">
              <Camera size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Tamanho máximo: 4 Mb</span>
        </div>

        {/* Basic Info Section */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Nome conforme documento (Obrigatório):" 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Ex: Adail Neto"
            />
            <Input 
              label="Data de Aniversário:" 
              type="date" 
              value={formData.birthDate} 
              onChange={e => setFormData({...formData, birthDate: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Celular:</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md shrink-0">
                  <img src="https://flagcdn.com/w20/br.png" alt="BR" className="w-5 h-auto rounded-sm" />
                  <span className="text-sm font-bold text-slate-600">+55</span>
                </div>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Telefone:</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md shrink-0">
                  <img src="https://flagcdn.com/w20/br.png" alt="BR" className="w-5 h-auto rounded-sm" />
                  <span className="text-sm font-bold text-slate-600">+55</span>
                </div>
                <Input 
                  value={formData.secondaryPhone} 
                  onChange={e => setFormData({...formData, secondaryPhone: e.target.value})} 
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Gênero:</label>
             <div className="flex flex-wrap gap-4">
                {['Masculino', 'Feminino', 'Outro', 'Prefiro não dizer'].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="gender" 
                      value={g} 
                      checked={formData.gender === g}
                      onChange={() => setFormData({...formData, gender: g as any})}
                      className="w-4 h-4 accent-teal-600"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-teal-600 transition-colors font-medium">{g}</span>
                  </label>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <Input 
          label="CPF:" 
          value={formData.cpf} 
          onChange={e => setFormData({...formData, cpf: e.target.value})} 
          placeholder="000.000.000-00"
        />
        <Input 
          label="RG:" 
          value={formData.rg} 
          onChange={e => setFormData({...formData, rg: e.target.value})} 
          placeholder="0.000.000"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input 
          label="E-mail:" 
          type="email"
          value={formData.email} 
          onChange={e => setFormData({...formData, email: e.target.value})} 
        />
        <Input 
          label="CEP:" 
          value={formData.cep} 
          onChange={e => setFormData({...formData, cep: e.target.value})} 
        />
        <Input 
          label="Endereço:" 
          value={formData.address} 
          onChange={e => setFormData({...formData, address: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input 
          label="Estado:" 
          value={formData.state} 
          onChange={e => setFormData({...formData, state: e.target.value})} 
        />
        <Input 
          label="Cidade:" 
          value={formData.city} 
          onChange={e => setFormData({...formData, city: e.target.value})} 
        />
        <Input 
          label="Bairro:" 
          value={formData.neighborhood} 
          onChange={e => setFormData({...formData, neighborhood: e.target.value})} 
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
        <Button onClick={onSuccess} variant="outline" type="button">Cancelar</Button>
        <Button type="submit" disabled={loading} className="px-12 bg-indigo-600 hover:bg-indigo-700">
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

// --- Anamnesis Form ---
export function AnamnesisForm({ client, initialData, onSuccess }: { client: Client, initialData?: Anamnesis, onSuccess: () => void }) {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [backupEmail, setBackupEmail] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setBackupEmail(settingsDoc.data().backupEmail);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de email:", err);
      }
    };
    fetchSettings();
  }, []);

  const [formData, setFormData] = useState<Partial<Anamnesis>>(initialData || {
    clientId: client.id,
    smoking: false,
    diabetes: false,
    hypertension: false,
    cardiacDisease: false,
    pacemaker: false,
    anticoagulant: false,
    renalProblem: false,
    hepatitis: false,
    aids: false,
    cancer: false,
    pregnancy: false,
    allergyMetals: false,
    mycosisNails: false,
    mycosisSkin: false,
    sports: false,
    painSensitivity: false,
    leprosy: false,
    circulatoryDisorder: false,
    lowerLimbSurgery: false,
    shoeType: 'Fechado',
    shoeSize: '',
    sockType: 'Social',
    footAssessmentLeft: '',
    footAssessmentRight: '',
    dermatologicalPathologies: [],
    nailPathologies: [],
    imageAuthorization: false,
    generalObservations: '',
    onicomicose: false,
    onicofose: false,
    orteses: false,
    ungueal: false,
    verrugaPlantar: false,
    fissuras: false,
    onicocriptose: false,
    onicogrifose: false,
    micoseUngeualMao: false,
    compromisedNailsHands: [],
    compromisedNailsFeet: [],
    medications: '',
    allergies: '',
    nailCondition: '',
    skinCondition: '',
    footType: 'Normal',
    sensibilityFoot: 'Normal',
    assessment: '',
    disclaimerAccepted: false,
    absenceTermAccepted: false,
    signatureDataUrl: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.disclaimerAccepted || !formData.absenceTermAccepted) {
      alert("É necessário aceitar todos os termos para continuar.");
      return;
    }
    setShowSignature(true);
  };

  const handleFinalSave = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert("Por favor, forneça uma assinatura.");
      return;
    }

    const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    setLoading(true);
    const path = 'anamnesis';
    const anamnesisData = {
      ...formData,
      clientId: client.id,
      signatureDataUrl: signature,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, path, client.id), anamnesisData, { merge: true });
      
      // Send email copy if configured
      if (backupEmail) {
        try {
          await fetch('/api/send-anamnesis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: backupEmail,
              clientName: client.name,
              anamnesisData: formData // Send the form data without serverTimestamp for serializability
            }),
          });
        } catch (emailErr) {
          console.error("Falha ao enviar cópia por email:", emailErr);
        }
      }

      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${client.id}`);
    } finally {
      setLoading(false);
    }
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  if (showSignature) {
    return (
      <div className="flex flex-col gap-6 p-4">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-800">Assinatura Digital</h3>
          <p className="text-sm text-slate-500">O cliente deve assinar no campo abaixo para validar o termo de responsabilidade.</p>
        </div>

        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-4">
          <div className="w-full bg-slate-50 rounded-xl overflow-hidden touch-none cursor-crosshair">
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="#0d9488"
              canvasProps={{
                className: "w-full h-64",
              }}
            />
          </div>
          
          <div className="flex gap-4 w-full">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 gap-2" 
              onClick={clearSignature}
            >
              <RotateCcw size={16} /> Limpar
            </Button>
            <Button 
              type="button" 
              className="flex-1 gap-2 bg-teal-600 hover:bg-teal-700" 
              onClick={handleFinalSave}
              disabled={loading}
            >
              {loading ? 'Salvando...' : (
                <>
                  <CheckCircle2 size={16} /> Confirmar e Salvar
                </>
              )}
            </Button>
          </div>
        </div>

        <Button 
          variant="ghost" 
          onClick={() => setShowSignature(false)} 
          disabled={loading}
          className="text-slate-400"
        >
          Voltar para a ficha
        </Button>
      </div>
    );
  }

  const CheckboxGroup = ({ title, options, selected, onToggle }: { title: string, options: { id: string, label: string }[], selected: string[], onToggle: (id: string) => void }) => (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 p-2 bg-slate-50/50 rounded border border-slate-100 hover:border-teal-200 transition-colors cursor-pointer">
            <input 
              type="checkbox" 
              checked={selected.includes(opt.id)}
              onChange={() => onToggle(opt.id)}
              className="w-4 h-4 accent-teal-600 rounded"
            />
            <span className="text-[11px] font-medium text-slate-600">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const RadioGroup = ({ label, options, value, onChange }: { label: string, options: { id: string, label: string }[], value: string, onChange: (val: string) => void }) => (
    <div className="flex flex-col gap-1.5">
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold rounded-md border transition-all",
              value === opt.id 
                ? "bg-teal-600 text-white border-teal-600 shadow-sm" 
                : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const BooleanToggle = ({ label, field }: { label: string, field: keyof Anamnesis }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-slate-100 shadow-sm">
      <span className="text-sm text-slate-600 font-medium">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, [field]: true })}
          className={cn(
            "px-3 py-1 rounded text-[10px] font-bold transition-all border",
            formData[field] === true 
              ? "bg-teal-600 text-white border-teal-600 shadow-sm" 
              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
          )}
        >
          SIM
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, [field]: false })}
          className={cn(
            "px-3 py-1 rounded text-[10px] font-bold transition-all border",
            formData[field] === false 
              ? "bg-slate-200 text-slate-700 border-slate-200" 
              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
          )}
        >
          NÃO
        </button>
      </div>
    </div>
  );

  const toggleNail = (field: 'compromisedNailsHands' | 'compromisedNailsFeet', nail: string) => {
    const current = formData[field] || [];
    if (current.includes(nail)) {
      setFormData({ ...formData, [field]: current.filter(n => n !== nail) });
    } else {
      setFormData({ ...formData, [field]: [...current, nail] });
    }
  };

  const NailSelector = ({ type, selected, onToggle }: { type: 'hands' | 'feet', selected: string[], onToggle: (nail: string) => void }) => {
    const handNails = [
      { id: 'h5', label: '5', name: 'Mínimo', h: 'h-8' },
      { id: 'h4', label: '4', name: 'Anelar', h: 'h-12' },
      { id: 'h3', label: '3', name: 'Médio', h: 'h-14' },
      { id: 'h2', label: '2', name: 'Indicador', h: 'h-12' },
      { id: 'h1', label: '1', name: 'Polegar', h: 'h-10', thumb: true }
    ];
    const footNails = [
      { id: 'f5', label: '5', name: '5º', h: 'h-6' },
      { id: 'f4', label: '4', name: '4º', h: 'h-8' },
      { id: 'f3', label: '3', name: '3º', h: 'h-9' },
      { id: 'f2', label: '2', name: '2º', h: 'h-10' },
      { id: 'f1', label: '1', name: 'Hálux', h: 'h-12', big: true }
    ];

    const items = type === 'hands' ? handNails : footNails;
    
    return (
      <div className="flex flex-col gap-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">
          Representação Visual: {type === 'hands' ? 'Mãos' : 'Pés'}
        </h5>
        
        <div className="flex justify-around items-end gap-1 px-2 min-h-[120px]">
          {/* Lado Esquerdo */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-[9px] font-bold text-slate-300 uppercase">Esq</span>
            <div className="flex items-end gap-1.5 h-24">
              {[...items].reverse().map((item) => {
                const nailId = `${item.id}-E`;
                const isSelected = selected.includes(nailId);
                return (
                  <button
                    key={nailId}
                    type="button"
                    onClick={() => onToggle(nailId)}
                    title={`${item.name} Esquerdo`}
                    className={cn(
                      "w-6 rounded-t-lg border-2 transition-all flex flex-col items-center justify-start pt-1",
                      item.h,
                      isSelected 
                        ? "bg-red-500 border-red-600 shadow-md -translate-y-1" 
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full border border-current opacity-20", isSelected ? "text-white" : "text-slate-400")} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-[1px] h-20 bg-slate-100 self-center mx-2" />

          {/* Lado Direito */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-[9px] font-bold text-slate-300 uppercase">Dir</span>
            <div className="flex items-end gap-1.5 h-24">
              {items.map((item) => {
                const nailId = `${item.id}-D`;
                const isSelected = selected.includes(nailId);
                return (
                  <button
                    key={nailId}
                    type="button"
                    onClick={() => onToggle(nailId)}
                    title={`${item.name} Direito`}
                    className={cn(
                      "w-6 rounded-t-lg border-2 transition-all flex flex-col items-center justify-start pt-1",
                      item.h,
                      isSelected 
                        ? "bg-red-500 border-red-600 shadow-md -translate-y-1" 
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full border border-current opacity-20", isSelected ? "text-white" : "text-slate-400")} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-1 text-[8px] font-bold text-slate-400 text-center opacity-60">
          <span>{type === 'hands' ? '5º' : '5º'}</span>
          <span>{type === 'hands' ? '4º' : '4º'}</span>
          <span>{type === 'hands' ? '3º' : '3º'}</span>
          <span>{type === 'hands' ? '2º' : '2º'}</span>
          <span>{type === 'hands' ? 'Polegar' : 'Hálux'}</span>
        </div>
      </div>
    );
  };

  const dermatologicalOptions = [
    { id: 'bromidrose', label: 'Bromidrose' },
    { id: 'desidrose', label: 'Desidrose' },
    { id: 'exostose', label: 'Exostose' },
    { id: 'granuloma', label: 'Granuloma' },
    { id: 'hiperidrose', label: 'Hiperidrose' },
    { id: 'hiperqueratose', label: 'Hiperqueratose' },
    { id: 'micoseInterdigital', label: 'Micose interdigital' },
    { id: 'micosePlantar', label: 'Micose plantar' },
    { id: 'micoseUngueal', label: 'Micose ungueal' },
    { id: 'onicofose', label: 'Onicofose' },
    { id: 'onicocriptose', label: 'Onicocriptose' },
    { id: 'psoriase', label: 'Psoríase' },
    { id: 'ressecamento', label: 'Ressecamento' },
    { id: 'outra', label: 'Outra' },
  ];

  const nailPathologyOptions = [
    { id: 'caracol', label: 'Caracol' },
    { id: 'distrofica', label: 'Distrófica' },
    { id: 'funil', label: 'Funil' },
    { id: 'gancho', label: 'Gancho' },
    { id: 'telha', label: 'Telha' },
    { id: 'torques', label: 'Torquês' },
    { id: 'outra', label: 'Outra' },
  ];

  const togglePathology = (field: 'dermatologicalPathologies' | 'nailPathologies', id: string) => {
    const current = formData[field] || [];
    if (current.includes(id)) {
      setFormData({ ...formData, [field]: current.filter(item => item !== id) });
    } else {
      setFormData({ ...formData, [field]: [...current, id] });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Seção: Hábitos e Identificação de Calçado */}
      <div className="space-y-6">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Hábitos e Calçados</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RadioGroup 
            label="Tipo de calçado mais utilizado" 
            options={[{ id: 'Aberto', label: 'Aberto' }, { id: 'Fechado', label: 'Fechado' }]}
            value={formData.shoeType}
            onChange={(val) => setFormData({ ...formData, shoeType: val })}
          />
          <Input 
            label="Número do calçado" 
            value={formData.shoeSize} 
            onChange={e => setFormData({ ...formData, shoeSize: e.target.value })} 
            placeholder="Ex: 38"
          />
          <RadioGroup 
            label="Tipo de meia usada" 
            options={[{ id: 'Esportiva', label: 'Esportiva' }, { id: 'Social', label: 'Social' }]}
            value={formData.sockType}
            onChange={(val) => setFormData({ ...formData, sockType: val })}
          />
          <BooleanToggle label="Pratica algum esporte?" field="sports" />
        </div>
      </div>

      {/* Seção de Saúde Geral Expandida */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Saúde Geral</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BooleanToggle label="Diabetes" field="diabetes" />
          <BooleanToggle label="Hipotensão / Hipertensão" field="hypertension" />
          <BooleanToggle label="Cardiopatia" field="cardiacDisease" />
          <BooleanToggle label="Marca-passo ou Pinos" field="pacemaker" />
          <BooleanToggle label="Hepatite" field="hepatitis" />
          <BooleanToggle label="AIDS (HIV)" field="aids" />
          <BooleanToggle label="Cirurgia membros inferiores" field="lowerLimbSurgery" />
          <BooleanToggle label="Hanseníase" field="leprosy" />
          <BooleanToggle label="Alergias" field="allergyMetals" />
          <BooleanToggle label="Distúrbio circulatório" field="circulatoryDisorder" />
          <BooleanToggle label="Sensibilidade a dor" field="painSensitivity" />
        </div>
      </div>

      {/* Patologias e Mapeamento de Unhas */}
      <div className="space-y-8">
        <CheckboxGroup 
          title="Patologias dermatológicas presentes"
          options={dermatologicalOptions}
          selected={formData.dermatologicalPathologies}
          onToggle={(id) => togglePathology('dermatologicalPathologies', id)}
        />

        <CheckboxGroup 
          title="Patologias ungueais presentes"
          options={nailPathologyOptions}
          selected={formData.nailPathologies}
          onToggle={(id) => togglePathology('nailPathologies', id)}
        />

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Mapeamento de Unhas Acometidas</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NailSelector 
              type="hands" 
              selected={formData.compromisedNailsHands || []} 
              onToggle={(nail) => toggleNail('compromisedNailsHands', nail)} 
            />
            <NailSelector 
              type="feet" 
              selected={formData.compromisedNailsFeet || []} 
              onToggle={(nail) => toggleNail('compromisedNailsFeet', nail)} 
            />
          </div>
        </div>
      </div>

      {/* Avaliação Técnica por Pé */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Avaliação Técnica</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Pé Esquerdo</label>
            <textarea 
              className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm min-h-[100px] focus:bg-white focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none"
              value={formData.footAssessmentLeft} 
              onChange={e => setFormData({...formData, footAssessmentLeft: e.target.value})}
              placeholder="Descreva o estado do pé esquerdo..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Pé Direito</label>
            <textarea 
              className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm min-h-[100px] focus:bg-white focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none"
              value={formData.footAssessmentRight} 
              onChange={e => setFormData({...formData, footAssessmentRight: e.target.value})}
              placeholder="Descreva o estado do pé direito..."
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Observações Gerais</label>
          <textarea 
            className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm min-h-[80px] focus:bg-white focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none"
            value={formData.generalObservations} 
            onChange={e => setFormData({...formData, generalObservations: e.target.value})}
            placeholder="Alguma observação adicional?"
          />
        </div>
      </div>

      {/* Seção de Micoses Detalhadas (Geral) */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Condições de Micose Detalhadas</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <BooleanToggle label="Onicomicose" field="onicomicose" />
          <BooleanToggle label="Onicofose" field="onicofose" />
          <BooleanToggle label="Órteses" field="orteses" />
          <BooleanToggle label="Ungueal" field="ungueal" />
          <BooleanToggle label="Verruga Plantar" field="verrugaPlantar" />
          <BooleanToggle label="Fissuras" field="fissuras" />
          <BooleanToggle label="Onicocriptose" field="onicocriptose" />
          <BooleanToggle label="Onicogrifose" field="onicogrifose" />
          <BooleanToggle label="Micose Ungueal (Mão)" field="micoseUngeualMao" />
        </div>
      </div>

      {/* Uso de Imagem e Termo */}
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-slate-700 uppercase">Uso de Imagem</h5>
              <p className="text-[10px] text-slate-400">Autoriza registro "antes" e "depois" para documentação?</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, imageAuthorization: !formData.imageAuthorization })}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-bold transition-all border",
                formData.imageAuthorization 
                  ? "bg-teal-600 text-white border-teal-600 shadow-sm" 
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
              )}
            >
              {formData.imageAuthorization ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
          <h5 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Termo de Responsabilidade</h5>
          <p className="text-[10px] text-amber-600/80 leading-relaxed text-justify">
            Declaro que as informações acima são verdadeiras e que omitir qualquer condição de saúde pode acarretar riscos ao procedimento. Autorizo a realização do tratamento podológico conforme avaliação técnica e isento o profissional de responsabilidades por reações adversas decorrentes de patologias ou alergias não informadas nesta ficha.
          </p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-teal-600 rounded"
              checked={formData.disclaimerAccepted}
              onChange={e => setFormData({...formData, disclaimerAccepted: e.target.checked})}
            />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Ciente e de Acordo</span>
          </label>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
          <h5 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Retornos e Ausências</h5>
          <p className="text-[10px] text-amber-600/80 leading-relaxed text-justify">
            O não comparecimento por mais de 60 dias encerra o ciclo de tratamento atual e a responsabilidade técnica da profissional. O retorno após este período será considerado uma nova consulta, sujeito a reavaliação e nova cobrança.
          </p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-teal-600 rounded"
              checked={formData.absenceTermAccepted}
              onChange={e => setFormData({...formData, absenceTermAccepted: e.target.checked})}
            />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Ciente e de Acordo</span>
          </label>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12 shadow-lg shadow-teal-500/20">
        {loading ? 'Salvando...' : 'Salvar Ficha de Anamnese Completa'}
      </Button>
    </form>
  );
}

// --- Command (Comanda) Form ---
export function CommandForm({ client, initialServices, initialCommand, appointmentId, onSuccess }: { client: Client, initialServices?: Service[], initialCommand?: Command, appointmentId?: string | null, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [guestName, setGuestName] = useState(client.id === 'guest' && client.name !== 'Cliente Avulso' ? client.name : '');
  const [guestPhone, setGuestPhone] = useState(client.id === 'guest' ? client.phone : '');
  const [registerGuest, setRegisterGuest] = useState(false);
  const [services, setServices] = useState<Service[]>(
    initialCommand ? initialCommand.services : 
    (initialServices && initialServices.length > 0 ? initialServices : [{ name: '', price: 0 }])
  );
  const [paymentMethod, setPaymentMethod] = useState<Command['paymentMethod']>(initialCommand?.paymentMethod || 'Dinheiro');
  const [cardBrand, setCardBrand] = useState<Command['cardBrand']>(initialCommand?.cardBrand);
  const [installments, setInstallments] = useState(initialCommand?.installments || 1);
  const [status, setStatus] = useState<Command['status']>(initialCommand?.status || 'open');
  const [availableServices, setAvailableServices] = useState<RegisteredService[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsubServices = onSnapshot(query(collection(db, 'services_catalog'), orderBy('name')), (snapshot) => {
      setAvailableServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegisteredService)));
    });
    const unsubProfessionals = onSnapshot(query(collection(db, 'professionals'), orderBy('name')), (snapshot) => {
      setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data() as AppSettings);
    });
    return () => { unsubServices(); unsubProfessionals(); unsubSettings(); };
  }, []);

  const addService = () => setServices([...services, { name: '', price: 0 }]);
  const removeService = (index: number) => setServices(services.filter((_, i) => i !== index));
  
  const updateService = (index: number, field: keyof Service, value: any) => {
    const newServices = [...services];
    let service = { ...newServices[index], [field]: value };

    if (field === 'name') {
      const registered = availableServices.find(s => s.name === value);
      if (registered) service.price = registered.defaultPrice;
    }

    if (field === 'professionalId') {
      const pro = professionals.find(p => p.id === value);
      if (pro) {
        service.professionalName = pro.name;
        service.commissionRate = pro.defaultCommission;
      } else {
        service.professionalName = undefined;
        service.commissionRate = 0;
      }
    }

    // Rough calculation for UI, considering fees if already selected
    const price = Number(service.price) || 0;
    const feeRate = getFeeRate();
    const netPrice = price * (1 - feeRate / 100);
    const rate = Number(service.commissionRate) || 0;
    service.commissionValue = (netPrice * rate) / 100;

    newServices[index] = service;
    setServices(newServices);
  };

  const total = services.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

  const getFeeRate = () => {
    if (!settings || !settings.fees) return 0;
    const fees = settings.fees;

    if (paymentMethod === 'Cartão de Débito') {
      const isVisaMaster = cardBrand === 'Visa' || cardBrand === 'Mastercard';
      const isEloAmex = cardBrand === 'Elo' || cardBrand === 'Amex' || cardBrand === 'Hipercard';
      
      if (isVisaMaster) return fees.debitVisaMaster || 0;
      if (isEloAmex) return fees.debitEloAmex || 0;
      return fees.debitVisaMaster || 0; // Default
    }

    if (paymentMethod === 'Link de Pagamento') return fees.paymentLink?.[installments - 1] || 0;
    
    if (paymentMethod === 'Cartão de Crédito') {
      const isVisaMaster = cardBrand === 'Visa' || cardBrand === 'Mastercard';
      const isEloAmex = cardBrand === 'Elo' || cardBrand === 'Amex' || cardBrand === 'Hipercard';
      
      if (isVisaMaster) return fees.creditVisaMaster?.[installments - 1] || 0;
      if (isEloAmex) return fees.creditEloAmex?.[installments - 1] || 0;
      return fees.creditVisaMaster?.[installments - 1] || 0; // Default
    }

    return 0;
  };

  const calculateCommissions = () => {
    const feeRate = getFeeRate();
    const feeAmount = (total * feeRate) / 100;
    const updatedServices = services.map(s => {
      const currentPrice = Number(s.price) || 0;
      const proportionalFee = total > 0 ? (currentPrice / total) * feeAmount : 0;
      const netPrice = currentPrice - proportionalFee;
      
      // Look up commission rate if missing but professional exists
      let rate = Number(s.commissionRate);
      if ((isNaN(rate) || rate === 0) && s.professionalId) {
        const pro = professionals.find(p => p.id === s.professionalId);
        if (pro) rate = pro.defaultCommission;
      }
      if (isNaN(rate)) rate = 0;

      const commissionValue = (netPrice * rate) / 100;
      return { ...s, netPrice, commissionRate: rate, commissionValue };
    });
    return { updatedServices, feeAmount, netTotal: total - feeAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (total <= 0) return alert('Adicione pelo menos um serviço');
    if (client.id === 'guest' && !guestName.trim()) return alert('Informe o nome do cliente');
    
    setLoading(true);
    const path = 'commands';
    const { updatedServices, feeAmount, netTotal } = calculateCommissions();

    try {
      let finalClientId = client.id;
      let finalClientName = client.name;

      if (client.id === 'guest') {
        finalClientName = guestName;
        if (registerGuest) {
          try {
            const clientRef = await addDoc(collection(db, 'clients'), {
              name: guestName,
              phone: guestPhone,
              createdAt: serverTimestamp(),
            });
            finalClientId = clientRef.id;
          } catch (err) {
            console.error("Erro ao pré-cadastrar cliente:", err);
          }
        }
      }

      const commandData: any = {
        clientId: finalClientId,
        clientName: finalClientName,
        services: updatedServices,
        total,
        feeAmount,
        netTotal,
        status,
        paymentMethod,
        cardBrand: (isCard && cardBrand) ? cardBrand : null,
        installments: isCredit ? (installments || 1) : 1,
        date: initialCommand ? initialCommand.date : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add closing time if status is paid and it was not paid before
      if (status === 'paid' && (!initialCommand || initialCommand.status !== 'paid')) {
        commandData.closedAt = serverTimestamp();
      } else if (initialCommand && initialCommand.closedAt) {
        commandData.closedAt = initialCommand.closedAt;
      }

      let commandId = initialCommand?.id;
      if (initialCommand) {
        await setDoc(doc(db, path, initialCommand.id), commandData, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, path), commandData);
        commandId = docRef.id;
        
        // If it came from an appointment, mark as attended
        if (appointmentId) {
          try {
            await updateDoc(doc(db, 'appointments', appointmentId), {
              status: 'attended'
            });
          } catch (err) {
            console.error("Erro ao atualizar status do agendamento:", err);
          }
        }
      }

      // Sync professional transactions
      if (commandId) {
        try {
          const q = query(collection(db, 'professional_transactions'), where('commandId', '==', commandId));
          const snapshots = await getDocs(q);
          const batch = writeBatch(db);
          snapshots.forEach((d) => batch.delete(d.ref));

          if (status === 'paid') {
            updatedServices.forEach(s => {
              if (s.professionalId && (s.commissionValue || 0) > 0) {
                const transRef = doc(collection(db, 'professional_transactions'));
                batch.set(transRef, {
                  professionalId: s.professionalId,
                  type: 'commission',
                  amount: s.commissionValue,
                  date: commandData.date,
                  notes: `Comissão: ${s.name} (Ref: ${finalClientName})`,
                  commandId: commandId
                });
              }
            });
          }
          await batch.commit();
        } catch (transErr) {
          console.error("Erro ao sincronizar transações do profissional:", transErr);
        }
      }

      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const isCard = paymentMethod === 'Cartão de Crédito' || paymentMethod === 'Cartão de Débito';
  const isCredit = paymentMethod === 'Cartão de Crédito' || paymentMethod === 'Link de Pagamento';

  const { updatedServices, feeAmount, netTotal } = calculateCommissions();
  const totalCommission = updatedServices.reduce((acc, s) => acc + (s.commissionValue || 0), 0);
  const netBalance = netTotal - totalCommission;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Calculadora de Procedimentos</h4>
          <Button type="button" variant="ghost" size="sm" onClick={addService} className="gap-2 text-white hover:bg-white/10 h-8 px-3">
            <Plus size={14} /> Adicionar Procedimento
          </Button>
        </div>

        {client.id === 'guest' && (
          <div className="bg-slate-800/30 p-4 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente Não Cadastrado</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Nome do Cliente</label>
                <input 
                  type="text" 
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Informe o nome..."
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Telefone (Opcional)</label>
                <input 
                  type="text" 
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/5 cursor-pointer hover:bg-slate-900 transition-colors">
              <input 
                type="checkbox" 
                checked={registerGuest}
                onChange={e => setRegisterGuest(e.target.checked)}
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <div>
                <p className="text-xs font-bold text-white">Cadastrar cliente na base</p>
                <p className="text-[10px] text-slate-500">Isso criará uma ficha de cliente automaticamente após salvar.</p>
              </div>
            </label>
          </div>
        )}

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {updatedServices.map((service, index) => (
            <div key={index} className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 space-y-4 animate-in slide-in-from-right-2 duration-300">
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Serviço/Procedimento</label>
                  <select
                    value={service.name}
                    onChange={e => updateService(index, 'name', e.target.value)}
                    className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Selecione...</option>
                    {availableServices.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({formatCurrency(s.defaultPrice)})</option>
                    ))}
                    <option value="Outro">Outro (Manual)</option>
                  </select>
                </div>
                <div className="w-28 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Valor</label>
                  <div className="relative">
                    <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="number" 
                      placeholder="0,00"
                      value={service.price || ''} 
                      onChange={e => updateService(index, 'price', parseFloat(e.target.value))} 
                      className="w-full h-10 pl-8 pr-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                    />
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => removeService(index)}
                  disabled={services.length === 1}
                  className="mt-6 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex gap-4 items-center bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
                <div className="flex-1 flex items-center gap-3">
                   <Briefcase size={14} className="text-teal-500" />
                   <select
                    value={service.professionalId || ''}
                    onChange={e => updateService(index, 'professionalId', e.target.value)}
                    className="flex-1 bg-transparent border-none text-white text-xs outline-none focus:ring-0 font-medium"
                   >
                    <option value="">Selecione o Profissional...</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                   </select>
                </div>
                {service.commissionValue !== undefined && service.commissionValue > 0 && (
                  <div className="text-right border-l border-white/5 pl-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Comissão</p>
                    <p className="text-[11px] font-mono font-bold text-teal-400">{formatCurrency(service.commissionValue)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-4 border-t border-white/5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pagamento</label>
            <select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Link de Pagamento">Link de Pagamento</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Status</label>
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
               {['open', 'paid'].map((s) => (
                 <button
                   key={s}
                   type="button"
                   onClick={() => setStatus(s as any)}
                   className={cn(
                     "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                     status === s 
                       ? (s === 'paid' ? "bg-emerald-600 text-white" : "bg-orange-600 text-white")
                       : "text-slate-400 hover:text-slate-200"
                   )}
                 >
                   {s === 'open' ? 'Pendente' : 'Pago'}
                 </button>
               ))}
            </div>
          </div>
        </div>

        {isCard && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bandeira do Cartão</label>
            <div className="flex flex-wrap gap-2">
              {['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'].map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setCardBrand(brand as any)}
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold rounded-xl border transition-all",
                    cardBrand === brand 
                      ? "bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-900/40" 
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                  )}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>
        )}

        {isCredit && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Parcelamento</label>
            <select 
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value))}
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <option key={n} value={n}>{n}x {n === 1 ? '(À vista)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="p-6 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 rounded-3xl flex flex-col gap-4 shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-teal-500/20 transition-all duration-500" />
          
          <div className="flex justify-between items-center relative z-10">
            <div>
              <span className="font-bold text-teal-400 uppercase text-[10px] tracking-[0.25em]">Subtotal do Atendimento</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-bold font-mono text-white tracking-tighter">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <DollarSign className="text-teal-400/30 mb-2" size={32} strokeWidth={1.5} />
              <div className="h-1 w-12 bg-teal-500/50 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Taxas Operacionais</p>
              <p className="text-lg font-bold text-rose-500 font-mono">
                {formatCurrency(feeAmount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo Líquido</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatCurrency(netTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Comissões</p>
              <p className="text-lg font-bold text-teal-500 font-mono">
                {formatCurrency(totalCommission)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo Clínica</p>
              <p className="text-lg font-bold text-white font-mono">
                {formatCurrency(netBalance)}
              </p>
            </div>
          </div>

          <div className="text-center pt-2 relative z-10">
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
              <Clock size={12} className="text-teal-500" />
              Fechamento em: <span className="text-white font-bold">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold rounded-2xl bg-teal-600 hover:bg-teal-500 shadow-xl shadow-teal-900/40 border-t border-white/10">
          {loading ? (
             <div className="flex items-center gap-3">
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               Processando...
             </div>
          ) : 'Finalizar Atendimento'}
        </Button>
      </div>
    </form>
  );
}

// --- Professional Form ---
export function ProfessionalForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const CALENDAR_COLORS = [
    '#0d9488', // Teal
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#6366f1', // Indigo
  ];
  const [formData, setFormData] = useState({ 
    name: '', 
    defaultCommission: 0,
    color: CALENDAR_COLORS[0],
    email: '',
    phone: '',
    password: ''
  });
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    const path = 'professionals';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setFormData({ 
        name: '', 
        defaultCommission: 0,
        color: CALENDAR_COLORS[0],
        email: '',
        phone: '',
        password: ''
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 animate-in fade-in slide-in-from-top-1">
          Profissional cadastrado com sucesso!
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Nome do Profissional" 
          required 
          value={formData.name} 
          onChange={e => setFormData({ ...formData, name: e.target.value })} 
          placeholder="Ex: Dra. Ana Silva"
        />
        <Input 
          label="E-mail de Acesso (Google)" 
          type="email"
          value={formData.email} 
          onChange={e => setFormData({ ...formData, email: e.target.value })} 
          placeholder="email@gmail.com"
        />
        <Input 
          label="Celular para Acesso" 
          value={formData.phone} 
          onChange={e => setFormData({ ...formData, phone: e.target.value })} 
          placeholder="Ex: 11999999999"
        />
        <Input 
          label="Senha de Acesso" 
          type="password"
          value={formData.password} 
          onChange={e => setFormData({ ...formData, password: e.target.value })} 
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Comissão Padrão (%)" 
          type="text" 
          required 
          value={formData.defaultCommission || ''} 
          onChange={e => {
            const val = e.target.value.replace(',', '.');
            setFormData({ ...formData, defaultCommission: parseFloat(val) || 0 });
          }} 
          placeholder="Ex: 50"
        />
      </div>
      <p className="text-[10px] text-slate-400 italic">Esta comissão será sugerida automaticamente ao criar novas comandas.</p>
      
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cor na Agenda</label>
        <div className="flex flex-wrap gap-2">
          {CALENDAR_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setFormData({ ...formData, color: c })}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all",
                formData.color === c ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full shadow-md shadow-teal-500/10">
        {loading ? 'Processando...' : 'Cadastrar Profissional'}
      </Button>
    </form>
  );
}

// --- Registered Service Form ---
export function ServiceRegistrationForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', defaultPrice: 0, category: 'Podologia' as const });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const path = 'services_catalog';
    try {
      console.log('Tentando adicionar serviço ao catálogo:', formData);
      await addDoc(collection(db, path), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setFormData({ name: '', defaultPrice: 0, category: 'Podologia' });
      onSuccess();
    } catch (error) {
      console.error('Erro ao cadastrar serviço:', error);
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  const CATEGORIES = ['Podologia', 'Manicure/Pedicure', 'Sobrancelhas', 'Depilação', 'Cílios', 'Outros'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Nome do Serviço" 
          required 
          value={formData.name} 
          onChange={e => setFormData({ ...formData, name: e.target.value })} 
          placeholder="Ex: Podologia Clínica"
        />
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
          <select
            value={formData.category}
            onChange={e => setFormData({ ...formData, category: e.target.value as any })}
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500 transition-colors"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>
      <Input 
        label="Preço Padrão (R$)" 
        type="text" 
        required 
        value={formData.defaultPrice || ''} 
        onChange={e => {
          const val = e.target.value.replace(',', '.');
          setFormData({ ...formData, defaultPrice: parseFloat(val) || 0 });
        }} 
        placeholder="Ex: 150.00"
      />
      <Button type="submit" disabled={loading} className="w-full shadow-md shadow-teal-500/10">
        {loading ? 'Processando...' : 'Adicionar ao Catálogo'}
      </Button>
    </form>
  );
}

// --- Image Compression Utility ---
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality JPEG
    };
  });
};

// --- Evolution Form ---
export function EvolutionForm({ client, onSuccess }: { client: Client, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [backupEmail, setBackupEmail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubPros = onSnapshot(query(collection(db, 'professionals'), orderBy('name')), (snapshot) => {
      setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
    });
    
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setBackupEmail(settingsDoc.data().backupEmail);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de email:", err);
      }
    };
    fetchSettings();
    return () => unsubPros();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setImages(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("Por favor, descreva a evolução ou o ocorrido.");
      return;
    }

    setLoading(true);
    try {
      const evolutionRef = collection(db, 'clients', client.id, 'evolution');
      await addDoc(evolutionRef, {
        clientId: client.id,
        date: serverTimestamp(),
        description: description.trim(),
        images,
        professionalId,
        professionalName,
        updatedAt: serverTimestamp()
      });

      // Send email copy if configured
      if (backupEmail) {
        try {
          await fetch('/api/send-evolution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: backupEmail,
              clientName: client.name,
              description: description.trim(),
              images,
              professionalName
            }),
          });
        } catch (emailErr) {
          console.error("Falha ao enviar evolução por email:", emailErr);
        }
      }

      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `clients/${client.id}/evolution`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profissional Responsável</label>
          <select 
            value={professionalId}
            onChange={e => {
              const p = professionals.find(pro => pro.id === e.target.value);
              setProfessionalId(e.target.value);
              setProfessionalName(p?.name || '');
            }}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium"
          >
            <option value="">Selecione...</option>
            {professionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
          Descrição da Evolução / Ocorrências
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva detalhadamente o que aconteceu durante o atendimento ou a evolução do caso..."
          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all outline-none resize-none"
          required
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
            Imagens de Acompanhamento
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              className="text-xs font-bold text-slate-500 hover:text-teal-600 flex items-center gap-1.5"
            >
              <UploadCloud size={16} /> Galeria
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1.5"
            >
              <Camera size={16} /> Tirar Foto
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={img} alt={`Evolução ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-500 hover:border-teal-200 transition-all cursor-pointer"
          >
            <Camera size={32} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Nenhuma imagem selecionada</span>
          </div>
        )}
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12 shadow-lg shadow-teal-500/20">
        {loading ? 'Salvando...' : 'Registrar Evolução'}
      </Button>
    </form>
  );
}

// --- Appointment Form ---
export function AppointmentForm({ client, onSuccess, initialDate, initialTime }: { client?: Client, onSuccess: () => void, initialDate?: string, initialTime?: string }) {
  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(!client);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<RegisteredService[]>([]);
  const [locations, setLocations] = useState<ClinicBranch[]>([]);

  const [formData, setFormData] = useState({
    clientId: client?.id || '',
    clientName: client?.name || '',
    clientPhone: client?.phone || '',
    professionalId: '',
    professionalName: '',
    serviceName: '',
    locationId: '',
    locationName: '',
    price: 0,
    paymentMethod: 'Pix' as any,
    date: initialDate || new Date().toISOString().split('T')[0],
    time: initialTime || '',
    duration: 30,
    notes: '',
  });

  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, 'clients'), orderBy('name')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    const unsubPros = onSnapshot(query(collection(db, 'professionals'), orderBy('name')), (snapshot) => {
      setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
    });
    const unsubServices = onSnapshot(query(collection(db, 'services_catalog'), orderBy('name')), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegisteredService)));
    });
    const unsubLocations = onSnapshot(query(collection(db, 'locations'), orderBy('name')), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClinicBranch));
      setLocations(locs);
      if (locs.length > 0 && !formData.locationId) {
        setFormData(prev => ({ ...prev, locationId: locs[0].id, locationName: locs[0].name }));
      }
    });
    return () => { unsubClients(); unsubPros(); unsubServices(); unsubLocations(); };
  }, []);

  const handleClientChange = (clientId: string) => {
    const found = clients.find(c => c.id === clientId);
    if (found) {
      setFormData({ 
        ...formData, 
        clientId: found.id, 
        clientName: found.name, 
        clientPhone: found.phone 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((isNewClient && !formData.clientName) || (!isNewClient && !formData.clientId) || !formData.date || !formData.time) {
      alert("Preencha os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      let finalClientId = formData.clientId;
      let finalClientName = formData.clientName;
      let finalClientPhone = formData.clientPhone;

      // If it's a new client, create it first
      if (isNewClient && !client) {
        const clientRef = await addDoc(collection(db, 'clients'), {
          name: formData.clientName,
          phone: formData.clientPhone,
          createdAt: serverTimestamp()
        });
        finalClientId = clientRef.id;
      }

      const dateTimeStart = new Date(`${formData.date}T${formData.time}`);
      const dateTimeEnd = new Date(dateTimeStart.getTime() + formData.duration * 60000);
      
      const selectedLocation = locations.find(l => l.id === formData.locationId);

      await addDoc(collection(db, 'appointments'), {
        clientId: finalClientId,
        clientName: finalClientName,
        clientPhone: finalClientPhone,
        professionalId: formData.professionalId,
        professionalName: formData.professionalName,
        serviceName: formData.serviceName,
        locationId: formData.locationId,
        locationName: selectedLocation?.name || '',
        price: formData.price,
        paymentMethod: formData.paymentMethod,
        date: dateTimeStart,
        endDate: dateTimeEnd,
        duration: formData.duration,
        status: 'scheduled',
        notes: formData.notes,
        createdAt: serverTimestamp(),
      });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!client && (
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button 
            type="button"
            onClick={() => setIsNewClient(false)}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              !isNewClient ? "bg-white text-teal-600 shadow-sm" : "text-slate-500"
            )}
          >
            Cliente Cadastrado
          </button>
          <button 
            type="button"
            onClick={() => setIsNewClient(true)}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              isNewClient ? "bg-white text-teal-600 shadow-sm" : "text-slate-500"
            )}
          >
            Novo Cliente
          </button>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Informações do Cliente</label>
        {client ? (
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700">
            {client.name}
          </div>
        ) : isNewClient ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input 
              placeholder="Nome do Cliente" 
              required
              value={formData.clientName}
              onChange={e => setFormData({ ...formData, clientName: e.target.value })}
            />
            <Input 
              placeholder="WhatsApp (Ex: 11999999999)" 
              value={formData.clientPhone}
              onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
            />
          </div>
        ) : (
          <select 
            required
            value={formData.clientId}
            onChange={e => handleClientChange(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500"
          >
            <option value="">Selecione um cliente...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data</label>
          <Input 
            type="date" 
            required
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Horário</label>
          <Input 
            type="time" 
            required
            value={formData.time}
            onChange={e => setFormData({ ...formData, time: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Duração</label>
          <select 
            value={formData.duration}
            onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium h-[46px]"
          >
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hora</option>
            <option value={90}>1h 30min</option>
            <option value={120}>2 horas</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unidade / Localização</label>
          <select 
            value={formData.locationId}
            onChange={e => {
              const l = locations.find(loc => loc.id === e.target.value);
              setFormData({ ...formData, locationId: e.target.value, locationName: l?.name || '' });
            }}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium"
          >
            <option value="">Selecione o local...</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profissional</label>
          <select 
            value={formData.professionalId}
            onChange={e => {
              const p = professionals.find(pro => pro.id === e.target.value);
              setFormData({ ...formData, professionalId: e.target.value, professionalName: p?.name || '' });
            }}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium"
          >
            <option value="">Selecione...</option>
            {professionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Serviço</label>
          <select 
            value={formData.serviceName}
            onChange={e => {
              const s = services.find(srv => srv.name === e.target.value);
              setFormData({ ...formData, serviceName: e.target.value, price: s?.defaultPrice || 0 });
            }}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium"
          >
            <option value="">Nenhum serviço</option>
            {services.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
          <Input 
            type="number"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
        <select 
          value={formData.paymentMethod}
          onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 font-medium h-[46px]"
        >
          <option value="Pix">Pix</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="Cartão de Débito">Cartão de Débito</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observações</label>
        <textarea 
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Alguma observação importante?"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20 outline-none focus:border-teal-500 resize-none"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12 shadow-lg shadow-teal-500/10">
        {loading ? 'Processando...' : 'Confirmar Agendamento'}
      </Button>
    </form>
  );
}

export function LocationForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    mapsUrl: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const path = 'locations';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      setFormData({ name: '', address: '', mapsUrl: '' });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input 
        label="Nome da Unidade (Ex: Palmas)" 
        required 
        value={formData.name} 
        onChange={e => setFormData({...formData, name: e.target.value})} 
      />
      <Input 
        label="Endereço / Localização" 
        value={formData.address} 
        onChange={e => setFormData({...formData, address: e.target.value})} 
      />
      <Input 
        label="Link do Google Maps (Opcional)" 
        value={formData.mapsUrl} 
        onChange={e => setFormData({...formData, mapsUrl: e.target.value})} 
        placeholder="https://goo.gl/maps/..."
      />
      <Button type="submit" disabled={loading} className="w-full shadow-md shadow-teal-500/10">
        {loading ? 'Processando...' : 'Cadastrar Unidade'}
      </Button>
    </form>
  );
}

// --- Professional Transaction Form (Vale / Pagamento) ---
export function ProfessionalTransactionForm({ professionalId, type, balance = 0, onSuccess }: { professionalId: string, type: 'payment' | 'advance', balance?: number, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addDoc(collection(db, 'professional_transactions'), {
        professionalId,
        type,
        amount: parseFloat(amount) || 0,
        notes: (e.currentTarget as HTMLFormElement).notes.value || '',
        date: serverTimestamp()
      });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'professional_transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1 ml-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Valor do {type === 'advance' ? 'Vale' : 'Pagamento'}
            </label>
            {type === 'payment' && balance > 0 && (
              <button 
                type="button"
                onClick={() => setAmount(balance.toFixed(2))}
                className="text-[10px] font-bold text-teal-500 hover:text-teal-400 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded cursor-pointer"
              >
                Pagar Total: {formatCurrency(balance)}
              </button>
            )}
          </div>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              name="amount" 
              type="number" 
              step="0.01" 
              required 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="pl-10 h-12 bg-slate-800 border-slate-700 text-white focus:ring-teal-500"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Observações</label>
          <textarea
            name="notes"
            className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-teal-500 resize-none h-24"
            placeholder="Opcional..."
          />
        </div>
      </div>
      <Button 
        type="submit" 
        disabled={loading}
        className={cn(
          "w-full h-12 rounded-xl text-sm font-bold shadow-lg transition-all",
          type === 'advance' ? "bg-orange-600 hover:bg-orange-500 shadow-orange-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
        )}
      >
        {loading ? "Processando..." : `Confirmar ${type === 'advance' ? 'Vale' : 'Pagamento'}`}
      </Button>
    </form>
  );
}

// --- Professional Login Form ---
export function ProfessionalLoginForm({ onLogin }: { onLogin: (pro: Professional) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const q = query(
        collection(db, 'professionals'), 
        where('phone', '==', phone.trim()),
        where('password', '==', password)
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const pro = { id: snap.docs[0].id, ...snap.docs[0].data() } as Professional;
        onLogin(pro);
      } else {
        setError('Celular ou senha incorretos.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
          <XCircle size={14} /> {error}
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Número de Celular</label>
          <div className="relative">
            <MessageCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ex: 11999999999"
              className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all font-medium"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
          <div className="relative">
            <Zap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all font-medium"
              required
            />
          </div>
        </div>
      </div>
      <Button 
        type="submit" 
        disabled={loading}
        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200"
      >
        {loading ? 'Autenticando...' : 'Acessar Painel Colaborador'}
      </Button>
    </form>
  );
}
