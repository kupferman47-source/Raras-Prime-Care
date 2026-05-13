import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui';
import { Star, CheckCircle2, MessageSquare, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Appointment } from '../types';

export function FeedbackForm({ appointmentId }: { appointmentId: string }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    async function loadAppointment() {
      try {
        const docRef = doc(db, 'appointments', appointmentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAppointment({ id: docSnap.id, ...docSnap.data() } as Appointment);
        }
      } catch (err) {
        console.error('Error loading appointment:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAppointment();
  }, [appointmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    try {
      await addDoc(collection(db, 'feedbacks'), {
        appointmentId,
        clientId: appointment?.clientId || '',
        clientName: appointment?.clientName || '',
        professionalId: appointment?.professionalId || '',
        professionalName: appointment?.professionalName || '',
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ClipboardList size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Atendimento não encontrado</h2>
          <p className="text-slate-500">O link de avaliação que você acessou pode estar incorreto ou expirado.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 text-center"
        >
          <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Muito obrigado!</h2>
          <p className="text-slate-500 mb-6">Sua avaliação é fundamental para mantermos a excelência em nossos atendimentos.</p>
          <div className="p-4 bg-slate-50 rounded-2xl text-sm italic text-slate-600 border border-slate-100">
            "Sua opinião ajuda o profissional {appointment.professionalName} a crescer cada vez mais."
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
          <div className="bg-teal-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10">
              <h1 className="text-2xl font-bold mb-2">Como foi seu atendimento?</h1>
              <p className="text-teal-50 opacity-90 text-sm">Raras Prime Care & Personal Podologia</p>
            </div>
          </div>

          <div className="p-8">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <ClipboardList size={28} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{appointment.serviceName || 'Procedimento'}</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">
                  Profissional: {appointment.professionalName}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="text-center">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest block mb-6">Sua nota para este atendimento</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform active:scale-95"
                    >
                      <Star
                        size={42}
                        className={cn(
                          "transition-all duration-200",
                          (hoverRating || rating) >= star 
                            ? "fill-amber-400 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" 
                            : "text-slate-200"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <div className="mt-4 h-6">
                  <AnimatePresence mode="wait">
                    {rating > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-teal-600 font-bold"
                      >
                        {rating === 1 && "Muito Insatisfeito"}
                        {rating === 2 && "Insatisfeito"}
                        {rating === 3 && "Regular"}
                        {rating === 4 && "Muito Bom"}
                        {rating === 5 && "Excelente"}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">
                  <MessageSquare size={16} /> Comentários (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte-nos o que você achou do atendimento..."
                  className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all text-slate-700 resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={rating === 0}
                className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl shadow-xl shadow-teal-900/10 text-lg font-bold"
              >
                Enviar Avaliação
              </Button>
            </form>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-400 text-xs font-medium">
          Agradecemos pela confiança em nosso trabalho.
        </p>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
