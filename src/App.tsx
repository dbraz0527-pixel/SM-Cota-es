import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Barcode, 
  Camera, 
  Plus, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  Search, 
  Users, 
  FileText, 
  CheckCircle2, 
  Download,
  X,
  Minus,
  ArrowLeft,
  Settings,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  MessageCircle,
  Share2,
  Edit2,
  Database,
  BookOpen,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { User, Quote, QuoteItem, ProductCatalog } from './types';
import { supabase } from './lib/supabase';

// --- Contexts ---
const AuthContext = createContext<{
  user: User | null;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
} | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---
const Layout = ({ children, title, showBack = false }: { children: React.ReactNode, title: string, showBack?: boolean }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-gray-50 shadow-xl relative">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="font-bold text-lg text-primary">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
            {user?.role === 'admin' ? 'Admin' : 'Func.'}
          </span>
          <button onClick={logout} className="p-2 text-gray-500">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t flex justify-around py-3 px-4 z-20">
        <Link to="/" className="flex flex-col items-center gap-1 text-primary">
          <FileText size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Cotações</span>
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin/users" className="flex flex-col items-center gap-1 text-gray-400">
            <Users size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Equipe</span>
          </Link>
        )}
        {user?.role === 'admin' && (
          <Link to="/admin/catalog" className="flex flex-col items-center gap-1 text-gray-400">
            <Database size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Catálogo</span>
          </Link>
        )}
        <Link to="/profile" className="flex flex-col items-center gap-1 text-gray-400">
          <Settings size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Perfil</span>
        </Link>
      </nav>
    </div>
  );
};

// --- Pages ---

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Falha no login');
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <Barcode size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-ink">SM Cotações</h1>
          <p className="text-gray-500 text-sm">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 ml-1">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 ml-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button type="submit" className="w-full btn-primary mt-4 py-4 text-lg">
            Entrar
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchQuotes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('quotes')
      .select('*, profiles(name)')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching quotes:', error);
    } else {
      setQuotes(data as Quote[]);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('quotes')
      .insert([{ 
        title: newTitle, 
        company_id: user.company_id,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) {
      alert('Erro ao criar cotação: ' + error.message);
    } else {
      navigate(`/quotes/${data.id}`);
    }
  };

  const handleDeleteQuote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir permanentemente esta cotação e todos os seus itens?')) return;
    
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      fetchQuotes();
    }
  };

  const filteredQuotes = quotes.filter(q => q.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout title="Minhas Cotações">
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar cotação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-100 shadow-sm focus:border-primary outline-none transition-all"
        />
      </div>

      <div className="space-y-3">
        {filteredQuotes.map(quote => (
          <motion.div 
            key={quote.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/quotes/${quote.id}`)}
            className="card p-4 flex items-center justify-between cursor-pointer border border-transparent hover:border-primary/20"
          >
            <div>
              <h3 className="font-semibold text-ink">{quote.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${quote.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {quote.status === 'open' ? 'Aberta' : 'Finalizada'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={(e) => handleDeleteQuote(e, quote.id)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
              <ChevronRight className="text-gray-300" size={20} />
            </div>
          </motion.div>
        ))}
        {filteredQuotes.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-20" />
            <p>Nenhuma cotação encontrada</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => setShowNewModal(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-accent text-white rounded-full shadow-lg flex items-center justify-center z-30"
      >
        <Plus size={28} />
      </button>

      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Nova Cotação</h2>
                <button onClick={() => setShowNewModal(false)} className="p-1"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Título do Arquivo</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                    placeholder="Ex: Cotação Hortifruti"
                    required
                  />
                </div>
                <button type="submit" className="w-full btn-primary py-4">
                  Criar e Iniciar
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const QuoteDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [quote, setQuote] = useState<Quote & { items: QuoteItem[] } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  // Add/Edit Modal State
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [searching, setSearching] = useState(false);
  const [catalogName, setCatalogName] = useState<string | null>(null);

  const fetchQuote = async () => {
    if (!id) return;
    
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (quoteError) {
      console.error('Error fetching quote:', quoteError);
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    } else {
      setQuote({ ...quoteData, items: itemsData as QuoteItem[] });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const handleSearchBarcode = async (codeOverride?: string) => {
    const codeToSearch = codeOverride || barcode;
    if (!codeToSearch || !user) return;
    setSearching(true);
    
    const { data, error } = await supabase
      .from('product_catalog')
      .select('product_name')
      .eq('company_id', user.company_id)
      .eq('barcode', codeToSearch)
      .single();
    
    if (data) {
      setProductName(data.product_name);
      setCatalogName(data.product_name);
    } else {
      setProductName('');
      setCatalogName(null);
    }
    setSearching(false);
    
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  useEffect(() => {
    if (barcode.length === 13 && !editingItem && !searching) {
      handleSearchBarcode();
    }
  }, [barcode]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    
    let finalSaveToCatalog = saveToCatalog;
    
    if (catalogName && productName !== catalogName) {
      if (confirm(`O nome no catálogo é "${catalogName}". Deseja atualizar para "${productName}" permanentemente?`)) {
        finalSaveToCatalog = true;
      } else {
        finalSaveToCatalog = false;
      }
    }

    if (editingItem) {
      const { error } = await supabase
        .from('quote_items')
        .update({ product_name: productName, quantity, updated_at: new Date().toISOString() })
        .eq('id', editingItem.id);
      
      if (error) {
        alert('Erro ao atualizar item: ' + error.message);
      } else {
        fetchQuote();
        setShowAddModal(false);
        setEditingItem(null);
      }
      return;
    }

    // Upsert logic for quote_items (barcode unique per quote_id)
    const { data: existingItem } = await supabase
      .from('quote_items')
      .select('id, quantity')
      .eq('quote_id', id)
      .eq('barcode', barcode)
      .single();

    if (existingItem) {
      const { error } = await supabase
        .from('quote_items')
        .update({ quantity: existingItem.quantity + quantity, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id);
      
      if (error) alert('Erro ao somar item: ' + error.message);
    } else {
      const { error } = await supabase
        .from('quote_items')
        .insert([{ 
          quote_id: id, 
          company_id: user.company_id,
          barcode, 
          product_name: productName, 
          quantity 
        }]);
      
      if (error) alert('Erro ao adicionar item: ' + error.message);
    }

    fetchQuote();
    setShowAddModal(false);
    setBarcode('');
    setProductName('');
    setQuantity(1);
    setCatalogName(null);
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItem(item);
    setBarcode(item.barcode);
    setProductName(item.product_name);
    setQuantity(item.quantity);
    setShowScanner(false);
    setShowAddModal(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Excluir este item?')) return;
    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', itemId);
    
    if (error) alert('Erro ao excluir item: ' + error.message);
    fetchQuote();
  };

  const handleFinalize = async () => {
    if (!confirm('Deseja finalizar esta cotação? Não será possível editar depois.')) return;
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) alert('Erro ao finalizar: ' + error.message);
    fetchQuote();
  };

  const exportCSV = () => {
    if (!quote) return;
    const headers = ['Código de barras', 'Nome do produto', 'Quantidade a ser pedida'];
    const rows = quote.items.map(item => [item.barcode, item.product_name, item.quantity]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${quote.title}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsAppShare = async () => {
    if (!quote) return;
    
    try {
      const headers = ['Código de barras', 'Nome do produto', 'Quantidade a ser pedida'];
      const rows = quote.items.map(item => [item.barcode, item.product_name, item.quantity]);
      const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const fileName = `${quote.title}.csv`;
      const file = new File([blob], fileName, { type: 'text/csv' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `SM Cotações - ${quote.title}`,
          text: `Segue a cotação: ${quote.title}`
        });
        return;
      }

      // Fallback: WhatsApp text only if file share fails
      const message = `SM Cotações - ${quote.title}\nTotal de itens: ${quote.items.length}\nData: ${new Date().toLocaleString('pt-BR')}\n\nItens:\n${quote.items.map(i => `- ${i.product_name}: ${i.quantity}`).join('\n')}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      console.error(err);
      alert('Erro ao compartilhar.');
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!quote) return <div className="p-8 text-center">Cotação não encontrada</div>;

  return (
    <Layout title={quote.title} showBack>
      <div className="space-y-4">
        {quote.status === 'open' && (
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { setShowScanner(true); setShowAddModal(true); }}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-primary text-white rounded-2xl shadow-md"
            >
              <Camera size={24} />
              <span className="text-xs font-bold uppercase">Escanear</span>
            </button>
            <button 
              onClick={() => { setShowScanner(false); setShowAddModal(true); }}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-accent text-accent rounded-2xl shadow-sm"
            >
              <Plus size={24} />
              <span className="text-xs font-bold uppercase">Digitar</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Itens Coletados ({quote.items.length})</h2>
          {quote.status === 'closed' && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase">Finalizada</span>
          )}
        </div>

        <div className="space-y-2">
          {quote.items.map(item => (
            <div key={item.id} className="card p-3 flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-sm leading-tight">{item.product_name}</h4>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.barcode}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">{item.quantity}</span>
                  <span className="text-[10px] text-gray-400 block -mt-1 uppercase">unid</span>
                </div>
                {quote.status === 'open' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditItem(item)} className="p-2 text-gray-300 hover:text-primary">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-200 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {quote.items.length === 0 && (
            <div className="text-center py-12 bg-white/50 rounded-2xl border-2 border-dashed border-gray-100">
              <p className="text-gray-400 text-sm">Nenhum item coletado ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-10">
        <div className="bg-white/80 backdrop-blur-md border border-gray-100 p-3 rounded-2xl shadow-2xl flex flex-col gap-2 pointer-events-auto">
          <div className="flex gap-2">
            <button 
              onClick={exportCSV}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-xl font-bold text-xs"
            >
              <Download size={16} /> CSV
            </button>
            <button 
              onClick={handleWhatsAppShare}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs"
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
          </div>
          {quote.status === 'open' && (
            <button 
              onClick={handleFinalize}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-sm"
            >
              <CheckCircle2 size={18} /> Finalizar Cotação
            </button>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
              style={{ maxHeight: '90vh' }}
            >
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="font-bold">{editingItem ? 'Editar Item' : 'Adicionar Produto'}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="p-1"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {showScanner && !editingItem && (
                  <div className="space-y-2">
                    <div id="reader" className="w-full rounded-xl overflow-hidden bg-black aspect-square"></div>
                    <button 
                      onClick={() => setShowScanner(false)}
                      className="w-full py-2 text-xs text-primary font-bold uppercase"
                    >
                      Usar Digitação Manual
                    </button>
                    <ScannerComponent onScan={(code) => { setBarcode(code); setShowScanner(false); handleSearchBarcode(code); }} />
                  </div>
                )}

                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código de Barras</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        inputMode="numeric"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        disabled={!!editingItem}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none font-mono disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="789..."
                        required
                      />
                      {!editingItem && (
                        <button 
                          type="button"
                          onClick={handleSearchBarcode}
                          disabled={searching}
                          className="px-4 bg-blue-50 text-primary rounded-xl"
                        >
                          {searching ? '...' : <Search size={20} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Produto</label>
                    <input 
                      type="text" 
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                      placeholder="Nome do item"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                    <span className="font-bold text-sm">Quantidade</span>
                    <div className="flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-10 h-10 rounded-full bg-white border flex items-center justify-center text-primary"
                      >
                        <Minus size={20} />
                      </button>
                      <input 
                        ref={quantityInputRef}
                        type="number"
                        inputMode="numeric"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="text-xl font-bold w-12 text-center bg-transparent border-b-2 border-primary outline-none"
                      />
                      <button 
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-10 h-10 rounded-full bg-white border flex items-center justify-center text-primary"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={saveToCatalog}
                      onChange={(e) => setSaveToCatalog(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-600">Salvar no catálogo interno</span>
                  </label>

                  <button type="submit" className="w-full btn-primary py-4 text-lg shadow-lg shadow-primary/20">
                    {editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const ScannerComponent = ({ onScan }: { onScan: (code: string) => void }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0
    }, false);

    scanner.render((decodedText) => {
      onScan(decodedText);
      scanner.clear();
    }, (error) => {
      // Ignore errors
    });

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, []);

  return null;
};

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'employee' as const });
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', currentUser.company_id);
    
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data as User[]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (editingUser) {
      const { error } = await supabase
        .from('profiles')
        .update({ name: formData.name, email: formData.email })
        .eq('id', editingUser.id);
      
      if (error) {
        alert('Erro ao atualizar: ' + error.message);
      } else {
        fetchUsers();
        setShowAdd(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', role: 'employee' });
      }
      return;
    }

    // Creating a new user via Supabase Auth requires an Edge Function or Admin API.
    // For this MVP, we'll assume the admin uses the Supabase dashboard or we use a signup flow.
    // However, the user requested "criar funcionário (admin)".
    // Since we don't have a backend, we'll use a mock approach or suggest using Supabase dashboard.
    // Actually, we can use `supabase.auth.signUp` but it will sign out the current user.
    // The correct way is using a service role key in a backend, which we don't have.
    // I'll implement it as a profile creation for now, but note that Auth user must exist.
    alert('Para criar novos usuários, use o Dashboard do Supabase ou implemente uma Edge Function.');
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentStatus })
      .eq('id', id);
    
    if (error) alert('Erro ao alterar status: ' + error.message);
    fetchUsers();
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setShowAdd(true);
  };

  return (
    <Layout title="Gerenciar Equipe">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Funcionários ({users.length})</h2>
        <button onClick={() => { setEditingUser(null); setFormData({ name: '', email: '', password: '', role: 'employee' }); setShowAdd(true); }} className="flex items-center gap-1 text-primary font-bold text-sm">
          <UserPlus size={18} /> Novo
        </button>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${u.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                {u.role === 'admin' ? <ShieldCheck size={20} /> : <Users size={20} />}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{u.name}</h3>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => startEdit(u)}
                className="p-2 text-gray-400 hover:text-primary"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => toggleStatus(u.id, !!u.active)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${u.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
              >
                {u.active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingUser ? 'Editar Perfil' : 'Novo Funcionário'}</h2>
                <button onClick={() => setShowAdd(false)} className="p-1"><X size={24} /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <input 
                  type="text" placeholder="Nome Completo" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200"
                />
                <input 
                  type="email" placeholder="E-mail" required
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200"
                />
                {!editingUser && (
                  <p className="text-[10px] text-gray-400">Nota: Novos usuários devem ser criados via Supabase Auth.</p>
                )}
                <button type="submit" className="w-full btn-primary py-4">{editingUser ? 'Salvar Alterações' : 'Cadastrar'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const AdminCatalogPage = () => {
  const [items, setItems] = useState<ProductCatalog[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('last_used_at_desc');
  const [editingItem, setEditingItem] = useState<ProductCatalog | null>(null);
  const [newName, setNewName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const fetchCatalog = async () => {
    if (!user) return;
    
    let query = supabase
      .from('product_catalog')
      .select('*')
      .eq('company_id', user.company_id);
    
    if (search) {
      query = query.or(`product_name.ilike.%${search}%,barcode.ilike.%${search}%`);
    }

    const [field, order] = sort.split('_');
    const isDesc = order === 'desc';
    
    // Map sort fields
    let sortField = field;
    if (field === 'lastUsedAt') sortField = 'last_used_at';
    if (field === 'productName') sortField = 'product_name';
    if (field === 'updatedAt') sortField = 'updated_at';

    const { data, error } = await query.order(sortField, { ascending: !isDesc });
    
    if (error) {
      console.error('Error fetching catalog:', error);
    } else {
      setItems(data as ProductCatalog[]);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [user, search, sort]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    const { error } = await supabase
      .from('product_catalog')
      .update({ product_name: newName, updated_at: new Date().toISOString() })
      .eq('id', editingItem.id);
    
    if (error) {
      alert('Erro ao atualizar: ' + error.message);
    } else {
      fetchCatalog();
      setEditingItem(null);
    }
  };

  const exportCatalog = () => {
    const headers = ['Código de barras', 'Nome do produto', 'Último uso', 'Atualizado em'];
    const rows = items.map(item => [item.barcode, item.product_name, item.last_used_at, item.updated_at]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogo-produtos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/);
      
      let totalEncontrados = 0;
      let inseridos = 0;
      let atualizados = 0;
      let ignorados = 0;

      for (const line of lines) {
        if (line.startsWith("|0200|")) {
          const parts = line.split('|').filter(p => p !== '');
          const productName = parts[2]?.trim();
          const barcode = parts[3]?.trim();

          if (barcode && /^\d{13}$/.test(barcode) && productName) {
            totalEncontrados++;
            const { data: existing } = await supabase
              .from('product_catalog')
              .select('id')
              .eq('company_id', user.company_id)
              .eq('barcode', barcode)
              .single();
            
            const { error } = await supabase
              .from('product_catalog')
              .upsert([{ 
                company_id: user.company_id, 
                barcode, 
                product_name: productName,
                last_used_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }], { onConflict: 'company_id,barcode' });
            
            if (!error) {
              if (existing) atualizados++;
              else inseridos++;
            }
          } else {
            if (line.trim()) ignorados++;
          }
        }
      }
      setImportStats({ totalEncontrados, inseridos, atualizados, ignorados });
      fetchCatalog();
      setImporting(false);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Layout title="Catálogo de Produtos">
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar no catálogo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-100 shadow-sm focus:border-primary outline-none"
            />
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="p-3 bg-primary text-white rounded-xl disabled:opacity-50"
            title="Importar SPED (.txt)"
          >
            {importing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={20} />}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".txt"
          />
          <button 
            onClick={exportCatalog}
            className="p-3 bg-gray-800 text-white rounded-xl"
            title="Exportar CSV"
          >
            <Download size={20} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'last_used_at_desc', label: 'Recentes' },
            { id: 'product_name_asc', label: 'A-Z' },
            { id: 'updated_at_desc', label: 'Atualizados' }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${sort === s.id ? 'bg-primary text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card p-4 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{item.product_name}</h3>
                <p className="text-[10px] text-gray-400 font-mono">{item.barcode}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-[9px] text-gray-400 uppercase">Uso: {new Date(item.last_used_at).toLocaleDateString('pt-BR')}</span>
                  <span className="text-[9px] text-gray-400 uppercase">Alt: {new Date(item.updated_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <button 
                onClick={() => { setEditingItem(item); setNewName(item.product_name); }}
                className="p-2 text-gray-300 hover:text-primary"
              >
                <Edit2 size={18} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Database size={48} className="mx-auto mb-3 opacity-20" />
              <p>Catálogo vazio ou nenhum item encontrado</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {importStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Relatório de Importação</h2>
                <button onClick={() => setImportStats(null)} className="p-1"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Encontrados</p>
                    <p className="text-2xl font-bold text-blue-600">{importStats.totalEncontrados}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-green-400 font-bold uppercase mb-1">Inseridos</p>
                    <p className="text-2xl font-bold text-green-600">{importStats.inseridos}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-orange-400 font-bold uppercase mb-1">Atualizados</p>
                    <p className="text-2xl font-bold text-orange-600">{importStats.atualizados}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ignorados</p>
                    <p className="text-2xl font-bold text-gray-600">{importStats.ignorados}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Produtos processados a partir das linhas |0200| do arquivo SPED.
                </p>
                <button 
                  onClick={() => setImportStats(null)}
                  className="w-full btn-primary py-4"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Editar no Catálogo</h2>
                <button onClick={() => setEditingItem(null)} className="p-1"><X size={24} /></button>
              </div>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-xl mb-2">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Código de Barras</p>
                  <p className="font-mono text-sm">{editingItem.barcode}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nome do Produto</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none"
                    required
                  />
                </div>
                <button type="submit" className="w-full btn-primary py-4">Salvar Alterações</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (passwords.new !== passwords.confirm) {
      setError('As senhas não coincidem');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwords.new
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowPasswordModal(false), 2000);
    }
  };

  return (
    <Layout title="Meu Perfil">
      <div className="flex flex-col items-center py-8">
        <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold mb-4">
          {user?.name.charAt(0)}
        </div>
        <h2 className="text-xl font-bold">{user?.name}</h2>
        <p className="text-gray-500">{user?.email}</p>
      </div>

      <div className="space-y-4">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-primary" size={20} />
            <span className="font-medium">Cargo</span>
          </div>
          <span className="text-sm text-gray-400 capitalize">{user?.role === 'admin' ? 'Administrador' : 'Funcionário'}</span>
        </div>
        
        <button 
          onClick={() => setShowPasswordModal(true)}
          className="w-full card p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="text-primary" size={20} />
            <span className="font-medium">Alterar Senha</span>
          </div>
          <ChevronRight className="text-gray-300" size={20} />
        </button>

        <button 
          onClick={logout}
          className="w-full card p-4 flex items-center justify-center gap-2 text-red-500 font-bold"
        >
          <LogOut size={20} /> Sair da Conta
        </button>
      </div>

      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Alterar Senha</h2>
                <button onClick={() => setShowPasswordModal(false)} className="p-1"><X size={24} /></button>
              </div>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nova Senha</label>
                  <input 
                    type="password" required
                    value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Confirmar Nova Senha</label>
                  <input 
                    type="password" required
                    value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200"
                  />
                </div>
                
                {error && <p className="text-red-500 text-sm">{error}</p>}
                {success && <p className="text-green-500 text-sm font-bold">Senha alterada com sucesso!</p>}
                
                <button type="submit" className="w-full btn-primary py-4">Confirmar Alteração</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

// --- Main App ---
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as User;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (credentials: any) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/quotes/:id" element={user ? <QuoteDetailPage /> : <Navigate to="/login" />} />
      <Route path="/admin/users" element={user?.role === 'admin' ? <AdminUsersPage /> : <Navigate to="/" />} />
      <Route path="/admin/catalog" element={user?.role === 'admin' ? <AdminCatalogPage /> : <Navigate to="/" />} />
      <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
    </Routes>
  );
}
