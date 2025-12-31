
import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  Sparkles, 
  User, 
  Layers, 
  Eye, 
  Download, 
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Package,
  FileArchive,
  ChevronRight,
  ChevronLeft,
  ArrowRightCircle,
  Maximize2,
  RotateCcw,
  X,
  Plus,
  Image as ImageIcon,
  Cloud,
  Settings2,
  Menu,
  Palette,
  Droplets
} from 'lucide-react';
import { Product, GeneratedImage, EditMode, ProcessingState } from './types';
import { processEcommerceImage } from './services/geminiService';
import { driveService } from './services/googleDriveService';
import JSZip from 'jszip';

const SHADES = [
  { name: 'Arctic White', color: '#FFFFFF', prompt: 'Pristine Arctic White (Pure neutral white)' },
  { name: 'Pearl Off-White', color: '#FAF9F6', prompt: 'Soft Pearl Off-White (Elegant subtle warmth)' },
  { name: 'Ivory Cream', color: '#FFF9E3', prompt: 'Warm Ivory Cream (Vintage silk white)' },
  { name: 'Eggshell White', color: '#F0EAD6', prompt: 'Matte Eggshell White (Neutral deep white)' },
  { name: 'Linen Off-White', color: '#E9E4D4', prompt: 'Dark Linen Off-White (Natural stone white)' }
];

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    message: '',
    progress: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState<string>('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProduct = products.find(p => p.id === selectedProductId);
  const productResults = history.filter(h => h.productId === selectedProductId);
  const currentViewImage = productResults.length > 0 ? productResults[0] : (currentProduct ? { url: currentProduct.originalUrl, type: 'original' } as any : null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newProduct: Product = {
          id: Math.random().toString(36).substr(2, 9),
          originalUrl: base64,
          name: file.name
        };
        
        setProducts(prev => [...prev, newProduct]);
        if (!selectedProductId) setSelectedProductId(newProduct.id);
        
        const initial: GeneratedImage = {
          id: Date.now().toString() + Math.random(),
          productId: newProduct.id,
          url: base64,
          type: 'original',
          timestamp: Date.now()
        };
        setHistory(prev => [initial, ...prev]);
      };
      reader.readAsDataURL(file);
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runEdit = async (mode: EditMode, specificPrompt?: string) => {
    const targets = isBatchMode ? products : (currentProduct ? [currentProduct] : []);
    if (targets.length === 0) return;

    setIsMobileMenuOpen(false);
    setProcessing({
      isProcessing: true,
      message: getLoadingMessage(mode),
      progress: 0,
      total: targets.length,
      current: 0
    });
    setError(null);

    try {
      for (let i = 0; i < targets.length; i++) {
        const product = targets[i];
        setProcessing(prev => ({ ...prev, current: i + 1, message: `Processing ${i + 1} of ${targets.length}...` }));
        
        let sourceUrl = product.originalUrl;
        if (!isBatchMode && currentViewImage && currentViewImage.productId === product.id && currentViewImage.type === EditMode.WHITE_BG) {
          sourceUrl = currentViewImage.url;
        }

        const result = await processEcommerceImage(sourceUrl, mode, specificPrompt || extraPrompt);
        if (result) {
          const newImage: GeneratedImage = {
            id: Date.now().toString() + Math.random(),
            productId: product.id,
            url: result,
            type: mode,
            timestamp: Date.now(),
            prompt: specificPrompt || extraPrompt,
            colorName: specificPrompt
          };
          setHistory(prev => [newImage, ...prev]);
        }
      }
    } catch (err) {
      setError("Studio failed. Try again.");
      console.error(err);
    } finally {
      setProcessing({ isProcessing: false, message: '', progress: 100 });
    }
  };

  const runShadePalette = async () => {
    if (!currentProduct) return;
    setIsMobileMenuOpen(false);
    setProcessing({
      isProcessing: true,
      message: "Starting Palette Gen...",
      progress: 0,
      total: SHADES.length,
      current: 0
    });

    try {
      for (let i = 0; i < SHADES.length; i++) {
        const shade = SHADES[i];
        setProcessing(prev => ({ ...prev, current: i + 1, message: `Dyeing: ${shade.name}...` }));
        
        const result = await processEcommerceImage(currentProduct.originalUrl, EditMode.COLOR_RECOLOR, shade.prompt);
        if (result) {
          const newImage: GeneratedImage = {
            id: Date.now().toString() + Math.random(),
            productId: currentProduct.id,
            url: result,
            type: EditMode.COLOR_RECOLOR,
            timestamp: Date.now(),
            prompt: shade.prompt,
            colorName: shade.name
          };
          setHistory(prev => [newImage, ...prev]);
        }
      }
    } catch (err) {
      setError("Palette generation failed.");
    } finally {
      setProcessing({ isProcessing: false, message: '', progress: 100 });
    }
  };

  const getLoadingMessage = (mode: EditMode) => {
    switch (mode) {
      case EditMode.WHITE_BG: return "Removing background...";
      case EditMode.MODEL_FRONT: return "Generating Front View...";
      case EditMode.COLOR_RECOLOR: return "Shifting color tone...";
      default: return "Studio Magic...";
    }
  };

  const downloadZip = async () => {
    if (history.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("studio-exports");
    const exportTargets = history.filter(h => h.type !== 'original');
    
    exportTargets.forEach((img, index) => {
      const base64Data = img.url.split(',')[1];
      const productName = products.find(p => p.id === img.productId)?.name || 'product';
      const typeLabel = img.colorName || img.type;
      const fileName = `${productName.split('.')[0]}-${typeLabel}-${index}.png`;
      folder?.file(fileName, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `studio-export-${Date.now()}.zip`;
    link.click();
  };

  const exportToDrive = async () => {
    const exportTargets = history.filter(h => h.type !== 'original');
    if (exportTargets.length === 0) return;

    setProcessing({
      isProcessing: true,
      message: "Syncing Drive...",
      progress: 0,
      total: exportTargets.length,
      current: 0
    });

    try {
      await driveService.authorize();
      const folderId = await driveService.createFolder(`Studio Exports ${new Date().toLocaleDateString()}`);
      for (let i = 0; i < exportTargets.length; i++) {
        const img = exportTargets[i];
        await driveService.uploadFile({
          name: `export-${i}-${img.colorName || img.type}.png`,
          base64: img.url,
          mimeType: 'image/png'
        }, folderId);
      }
      alert("Exported to Drive!");
    } catch (err) {
      setError("Drive connection failed.");
    } finally {
      setProcessing({ isProcessing: false, message: '', progress: 100 });
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-gray-100 hidden md:block">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-200">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-800">VisualStudio</h1>
        </div>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Studio Edition</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        <section>
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Inventory</h2>
            {products.length > 0 && (
              <button onClick={() => { setProducts([]); setHistory([]); setSelectedProductId(null); }} className="text-[10px] text-red-500 font-bold hover:underline">Clear</button>
            )}
          </div>
          <div className="flex md:grid md:grid-cols-4 gap-2 overflow-x-auto pb-2 no-scrollbar px-2">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`flex-shrink-0 w-12 h-12 md:w-full md:aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  selectedProductId === p.id ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-transparent bg-gray-50'
                }`}
              >
                <img src={p.originalUrl} className="w-full h-full object-cover" alt={p.name} />
              </button>
            ))}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-12 h-12 md:w-full md:aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-indigo-300 bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Studio Modes</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className={`text-[10px] font-bold ${isBatchMode ? 'text-indigo-600' : 'text-gray-400'}`}>BATCH</span>
              <input type="checkbox" className="sr-only peer" checked={isBatchMode} onChange={() => setIsBatchMode(!isBatchMode)} />
              <div className="w-8 h-4 bg-gray-200 rounded-full peer-checked:bg-indigo-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
            </label>
          </div>

          <div className="space-y-5 px-2">
             <div className="space-y-1">
               <h3 className="text-[9px] font-black text-gray-400 uppercase mb-2">Cleanup</h3>
               <ToolButton icon={<Layers className="w-4 h-4" />} label="Clear Background" description="Clean white plate" onClick={() => runEdit(EditMode.WHITE_BG)} disabled={products.length === 0 || processing.isProcessing} active={currentViewImage?.type === EditMode.WHITE_BG} />
             </div>

             <div className="space-y-2">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">White Shades Lab</h3>
                 <button 
                  onClick={runShadePalette} 
                  disabled={products.length === 0 || processing.isProcessing || isBatchMode}
                  className="flex items-center gap-1 text-[9px] font-black text-indigo-600 hover:text-indigo-700 disabled:opacity-30"
                 >
                   <Palette className="w-3 h-3" /> GEN ALL 5
                 </button>
               </div>
               <div className="grid grid-cols-5 gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  {SHADES.map(shade => (
                    <button
                      key={shade.name}
                      onClick={() => runEdit(EditMode.COLOR_RECOLOR, shade.prompt)}
                      disabled={products.length === 0 || processing.isProcessing}
                      title={shade.name}
                      className="aspect-square rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform active:scale-90"
                      style={{ backgroundColor: shade.color }}
                    />
                  ))}
               </div>
               <p className="text-[8px] text-gray-400 font-bold text-center italic">Light to Dark White Gradient</p>
             </div>

             <div className="space-y-1">
               <h3 className="text-[9px] font-black text-gray-400 uppercase mb-2">Fashion Studio</h3>
               <ToolButton icon={<User className="w-4 h-4" />} label="Front Pose" description="Centered alignment" onClick={() => runEdit(EditMode.MODEL_FRONT)} disabled={products.length === 0 || processing.isProcessing} active={currentViewImage?.type === EditMode.MODEL_FRONT} />
               <ToolButton icon={<RotateCcw className="w-4 h-4" />} label="Back Pose" description="Rear detail focus" onClick={() => runEdit(EditMode.MODEL_BACK)} disabled={products.length === 0 || processing.isProcessing} active={currentViewImage?.type === EditMode.MODEL_BACK} />
               <ToolButton icon={<ArrowRightCircle className="w-4 h-4" />} label="Side Profile" description="90° Silhouette" onClick={() => runEdit(EditMode.MODEL_SIDE)} disabled={products.length === 0 || processing.isProcessing} active={currentViewImage?.type === EditMode.MODEL_SIDE} />
               <ToolButton icon={<Maximize2 className="w-4 h-4" />} label="3/4 View" description="Depth perspective" onClick={() => runEdit(EditMode.MODEL_3_4)} disabled={products.length === 0 || processing.isProcessing} active={currentViewImage?.type === EditMode.MODEL_3_4} />
             </div>
          </div>
        </section>

        {products.length > 0 && (
          <section className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 mx-2">
            <h3 className="text-[10px] font-bold mb-2 text-indigo-900 uppercase">Context</h3>
            <textarea 
              className="w-full text-xs p-3 rounded-xl border border-indigo-100 focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none transition-all bg-white"
              placeholder="E.g. Tall model, soft shadows..."
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
            />
          </section>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm hidden md:block">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 disabled:opacity-50"
          disabled={processing.isProcessing}
        >
          <Upload className="w-4 h-4" /> Bulk Upload
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-900 overflow-hidden relative">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />

      {/* Mobile Header */}
      <header className="md:hidden flex h-14 bg-white border-b border-gray-100 items-center justify-between px-4 z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-600 w-5 h-5" />
          <span className="font-bold text-sm tracking-tight">VisualStudio</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={downloadZip} className="p-2 bg-gray-900 text-white rounded-lg">
              <Download className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sidebar - Responsive */}
      <aside className={`fixed md:relative z-50 md:z-20 w-80 h-full bg-white border-r border-gray-200 flex flex-col shadow-2xl md:shadow-none transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Mobile Close Button */}
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 p-2 bg-gray-50 rounded-full text-gray-400">
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col bg-white overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 border-b border-gray-100 items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-700 truncate max-w-[300px]">
              {currentProduct ? currentProduct.name : 'Choose a product'}
            </span>
            {currentViewImage && (
               <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                  {currentViewImage.colorName || currentViewImage.type}
               </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <>
                <button onClick={exportToDrive} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-bold transition-all shadow-sm">
                  <Cloud className="w-4 h-4 text-blue-500" /> Drive
                </button>
                <button onClick={downloadZip} className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold transition-all shadow-md">
                  <FileArchive className="w-4 h-4" /> Export ZIP
                </button>
              </>
            )}
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-hidden bg-[#fafafa]">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-500 text-white px-6 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
               <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {products.length === 0 ? (
            <div className="max-w-md w-full p-8 text-center space-y-6" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mx-auto shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">E-com Studio</h3>
                <p className="text-gray-500 text-sm font-medium px-4">
                  Upload products to generate model angles and professional color variations automatically.
                </p>
              </div>
              <button className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-indigo-100">Upload Products</button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className={`relative w-full h-full max-w-lg bg-white p-2 md:p-6 rounded-[2.5rem] shadow-2xl transition-all duration-700 ${processing.isProcessing ? 'scale-[0.98] opacity-50 grayscale' : 'scale-100 opacity-100'}`}>
                <div className="w-full h-full rounded-[1.8rem] overflow-hidden bg-gray-50 flex items-center justify-center">
                   <img src={currentViewImage?.url} className="w-full h-full object-contain" alt="Current View" />
                </div>
                
                {processing.isProcessing && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                      <div className="relative w-14 h-14 mb-4">
                        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                        <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-indigo-600 font-black text-sm mb-1 uppercase tracking-widest">{processing.message}</p>
                      {processing.total && processing.total > 1 && (
                        <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-4">
                          <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${((processing.current || 0) / processing.total) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {!processing.isProcessing && currentViewImage?.type !== 'original' && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex justify-center">
                     <button 
                        onMouseDown={() => { const orig = history.find(h => h.productId === selectedProductId && h.type === 'original'); if (orig) { (window as any)._lastView = currentViewImage; setHistory(prev => [orig, ...prev.filter(x => x.id !== orig.id)]); } }} 
                        onMouseUp={() => { const last = (window as any)._lastView; if (last) setHistory(prev => [last, ...prev.filter(x => x.id !== last.id)]); }}
                        onTouchStart={() => { const orig = history.find(h => h.productId === selectedProductId && h.type === 'original'); if (orig) { (window as any)._lastView = currentViewImage; setHistory(prev => [orig, ...prev.filter(x => x.id !== orig.id)]); } }}
                        onTouchEnd={() => { const last = (window as any)._lastView; if (last) setHistory(prev => [last, ...prev.filter(x => x.id !== last.id)]); }}
                        className="px-6 py-3 bg-gray-900/90 text-white rounded-full text-[10px] font-black tracking-widest uppercase backdrop-blur-md shadow-2xl transition-all active:scale-95 active:bg-black select-none"
                      >
                        Hold to Compare
                      </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Nav (Mobile Only) */}
        <nav className="md:hidden flex h-16 bg-white border-t border-gray-100 items-center justify-around px-2 pb-safe z-40">
           <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 text-gray-400">
             <Plus className="w-5 h-5" />
             <span className="text-[9px] font-bold uppercase">Add</span>
           </button>
           <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 text-indigo-600">
             <div className="bg-indigo-50 p-2 rounded-xl -mt-8 shadow-lg shadow-indigo-100">
                <Settings2 className="w-6 h-6" />
             </div>
             <span className="text-[9px] font-black uppercase">Studio</span>
           </button>
           <button onClick={exportToDrive} disabled={history.length === 0} className="flex flex-col items-center gap-1 text-gray-400 disabled:opacity-30">
             <Cloud className="w-5 h-5" />
             <span className="text-[9px] font-bold uppercase">Drive</span>
           </button>
        </nav>

        {/* Desktop Status Bar */}
        <div className="hidden md:flex h-12 border-t border-gray-100 items-center justify-between px-8 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <span className="text-indigo-600">Studio Engine v2.5</span>
            <span className="flex items-center gap-1.5"><Package className="w-3 h-3" /> {products.length} Products</span>
          </div>
          {selectedProductId && products.length > 1 && (
            <div className="flex items-center gap-4 text-gray-900 font-black">
              <button onClick={() => { const idx = products.findIndex(p => p.id === selectedProductId); if (idx > 0) setSelectedProductId(products[idx-1].id); }} className="hover:text-indigo-600 disabled:opacity-20" disabled={products.findIndex(p => p.id === selectedProductId) === 0}><ChevronLeft className="w-4 h-4" /></button>
              <span>{products.findIndex(p => p.id === selectedProductId) + 1} / {products.length}</span>
              <button onClick={() => { const idx = products.findIndex(p => p.id === selectedProductId); if (idx < products.length - 1) setSelectedProductId(products[idx+1].id); }} className="hover:text-indigo-600 disabled:opacity-20" disabled={products.findIndex(p => p.id === selectedProductId) === products.length - 1}><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </main>

      {/* Backdrop for Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-300" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, description, onClick, disabled, active }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center text-left p-3 rounded-2xl border transition-all duration-200 group ${
      active ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.97]'}`}
  >
    <div className={`p-2.5 rounded-xl mr-3 ${active ? 'bg-white/20' : 'bg-gray-50 text-gray-500'}`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-black tracking-tight leading-none mb-1">{label}</div>
      <div className={`text-[9px] font-bold truncate ${active ? 'text-indigo-100' : 'text-gray-400'}`}>{description}</div>
    </div>
  </button>
);

export default App;
