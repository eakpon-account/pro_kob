import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Image as ImageIcon,
  ExternalLink,
  Link2,
  Sparkles,
  Copy,
  Info,
  HardDrive,
  Check,
  Zap,
  FolderOpen,
  Eye,
  Sliders,
  Layers,
  FileCheck
} from 'lucide-react';
import { imageStorage, SYSTEM_PRESET_AVATARS, SystemImageItem } from '../services/imageStorage';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentAvatar?: string;
  onAvatarUpdated: (newAvatarUrl: string) => void;
}

export const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  currentAvatar,
  onAvatarUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'upload_system' | 'image_url' | 'system_presets'>('upload_system');
  
  // Local Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageDetails, setImageDetails] = useState<{
    width?: number;
    height?: number;
    sizeKb?: number;
    mimeType?: string;
  } | null>(null);

  // Direct Address / URL Input State
  const [urlInput, setUrlInput] = useState('');
  const [isTestingUrl, setIsTestingUrl] = useState(false);

  // Active Selected / Working Address
  const [currentAddress, setCurrentAddress] = useState<string>(currentAvatar || '');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [showFullView, setShowFullView] = useState(false);

  // Saved system history images
  const [systemImages, setSystemImages] = useState<SystemImageItem[]>([]);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initUrl = currentAvatar || '';
      setCurrentAddress(initUrl);
      setUrlInput(initUrl);
      setSelectedFile(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setCopiedAddress(false);
      setImageDetails(null);
      setSystemImages(imageStorage.getSystemImages());

      if (initUrl) {
        calculateImageStats(initUrl);
      }
    }
  }, [isOpen, currentAvatar]);

  if (!isOpen) return null;

  const calculateImageStats = (src: string) => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      let sizeKb = 0;
      if (src.startsWith('data:')) {
        sizeKb = Number(((src.length * 3) / 4 / 1024).toFixed(1));
      }
      setImageDetails({
        width: img.width,
        height: img.height,
        sizeKb: sizeKb > 0 ? sizeKb : undefined,
        mimeType: src.startsWith('data:') ? src.split(';')[0].replace('data:', '') : 'image/web',
      });
    };
    img.src = src;
  };

  // Handle local file selection and direct processing into system
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('ขนาดไฟล์ต้นฉบับต้องไม่เกิน 20 MB');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanName = `avatar_${userName.replace(/[\s\/\\]+/g, '_')}_${Date.now().toString().slice(-4)}.jpg`;
      const processed = await imageStorage.processAndStoreImage(file, cleanName, 480, 480, 0.88);
      
      setCurrentAddress(processed.address);
      setImageDetails({
        width: processed.width,
        height: processed.height,
        sizeKb: processed.sizeKb,
        mimeType: processed.mimeType,
      });
      setSystemImages(imageStorage.getSystemImages());
      setSuccessMessage(`ประมวลผลและจัดเก็บรูปภาพในระบบสำเร็จ (${processed.sizeKb} KB)`);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle direct URL / Image link input
  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!val.trim()) {
      setCurrentAddress(currentAvatar || '');
      return;
    }

    const resolved = imageStorage.resolveDirectImageUrl(val);
    setCurrentAddress(resolved);
    calculateImageStats(resolved);
  };

  // Select a preset avatar
  const handleSelectPreset = (preset: { address: string; label: string }) => {
    setCurrentAddress(preset.address);
    setUrlInput(preset.address);
    setSelectedFile(null);
    calculateImageStats(preset.address);
    setSuccessMessage(`เลือกรูปโปรไฟล์: ${preset.label}`);
  };

  // Select an already saved system image
  const handleSelectSavedSystemImage = (item: SystemImageItem) => {
    setCurrentAddress(item.address);
    setUrlInput(item.address);
    setSelectedFile(null);
    setImageDetails({
      width: item.width,
      height: item.height,
      sizeKb: item.sizeKb,
      mimeType: item.mimeType,
    });
    setSuccessMessage(`เลือกรูปภาพจากคลังระบบ: ${item.name}`);
  };

  // Copy Address Action
  const handleCopyImageAddress = async () => {
    if (!currentAddress) return;
    const success = await imageStorage.copyAddress(currentAddress);
    if (success) {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
    }
  };

  // Save / Apply Avatar to Profile
  const handleApplyAvatar = () => {
    if (!currentAddress) {
      setErrorMessage('กรุณาเลือกรูปภาพหรือระบุที่อยู่รูปภาพก่อนบันทึก');
      return;
    }

    try {
      onAvatarUpdated(currentAddress);
      setSuccessMessage('บันทึกรูปโปรไฟล์เข้าสู่ระบบเรียบร้อยแล้ว!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถบันทึกรูปภาพได้');
    }
  };

  const addressMeta = imageStorage.describeAddress(currentAddress);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <span>ตั้งค่ารูปโปรไฟล์และที่อยู่รูปภาพ</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  สำหรับผู้ใช้: <span className="font-bold text-slate-700">{userName}</span>
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Notifications */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 mb-3.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 mb-3.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Primary Live Preview & Image Address Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4.5 space-y-3 shadow-2xs">
            
            <div className="flex items-center gap-4">
              {/* Profile Avatar Frame */}
              <div className="relative shrink-0 group">
                <img
                  src={currentAddress || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                  alt="Avatar Preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
                  }}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
                />

                {currentAddress && (
                  <button
                    type="button"
                    onClick={() => setShowFullView(!showFullView)}
                    className="absolute inset-0 bg-slate-900/60 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold gap-1 cursor-pointer"
                    title="ดูรูปขนาดเต็ม"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Info & Specs */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">รูปโปรไฟล์ปัจจุบัน</span>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    <Check className="w-3 h-3 text-emerald-600" />
                    {addressMeta.typeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                  {imageDetails?.width && imageDetails?.height && (
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                      {imageDetails.width} × {imageDetails.height} px
                    </span>
                  )}
                  {imageDetails?.sizeKb && (
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono font-semibold text-slate-700">
                      {imageDetails.sizeKb} KB
                    </span>
                  )}
                  <span className="text-slate-400">
                    {currentAddress ? 'พร้อมใช้งานในระบบ' : 'ยังไม่มีรูปภาพ'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1">
                  {selectedFile ? `ไฟล์ที่เลือก: ${selectedFile.name}` : 'จัดเก็บในระบบเรียบร้อย'}
                </p>
              </div>
            </div>

            {/* Dedicated Image Address Box (ขอที่อยู่รูปภาพ) */}
            <div className="pt-2.5 border-t border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>ที่อยู่รูปภาพ (Image Address / URL):</span>
                </label>

                {currentAddress && (
                  <button
                    id="btn-copy-image-address"
                    type="button"
                    onClick={handleCopyImageAddress}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      copiedAddress 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="w-3 h-3 text-white" />
                        <span>คัดลอกที่อยู่แล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>คัดลอกที่อยู่รูปภาพ</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Address display bar */}
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700">
                <span className="truncate flex-1 select-all" title={currentAddress || 'ไม่มีที่อยู่รูปภาพ'}>
                  {currentAddress || 'ยังไม่มีที่อยู่รูปภาพ'}
                </span>
                
                {currentAddress && (
                  <a
                    href={currentAddress}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded transition-colors"
                    title="เปิดดูรูปภาพในแท็บใหม่"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

          </div>

          {/* Tab Navigation */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
            
            <button
              id="tab-upload-system"
              type="button"
              onClick={() => {
                setActiveTab('upload_system');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upload_system'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. อัปโหลดไว้ในระบบ (แนะนำ)</span>
            </button>

            <button
              id="tab-image-url"
              type="button"
              onClick={() => {
                setActiveTab('image_url');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'image_url'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>2. ระบุที่อยู่รูปภาพ (URL)</span>
            </button>

            <button
              id="tab-system-presets"
              type="button"
              onClick={() => {
                setActiveTab('system_presets');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'system_presets'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>3. คลังรูปภาพมาตรฐาน</span>
            </button>

          </div>

          {/* TAB 1: UPLOAD TO SYSTEM */}
          {activeTab === 'upload_system' && (
            <div className="space-y-3.5 mb-4">
              
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                  selectedFile 
                    ? 'border-emerald-400 bg-emerald-50/40' 
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5 shadow-2xs">
                  {isProcessing ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <p className="text-xs font-bold text-slate-800 text-center">
                  {isProcessing 
                    ? 'กำลังประมวลผลและจัดเก็บรูปภาพเข้าสู่ระบบ...' 
                    : selectedFile 
                    ? 'เลือกไฟล์ใหม่: คลิกเพื่อเปลี่ยนรูปภาพ' 
                    : 'คลิกเลือกรูปภาพจากเครื่องคอมพิวเตอร์ / สมาร์ทโฟน'}
                </p>

                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  ระบบจะปรับขนาดและบันทึกไว้ในระบบโดยตรง พร้อมสร้างที่อยู่รูปภาพให้อัตโนมัติ
                </p>
              </div>

              {/* Benefit Box */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ข้อดีของการจัดเก็บในระบบ:</span>
                  <p className="text-emerald-800 leading-relaxed mt-0.5">
                    รูปภาพจะถูกปรับขนาดและจัดเก็บเป็นข้อมูลความเร็วสูงภายในระบบโดยตรง ทำงานได้ทันทีทั้งแบบออฟไลน์และออนไลน์ สะดวก รวดเร็ว และเป็นส่วนตัว
                  </p>
                </div>
              </div>

              {/* Saved System Image History */}
              {systemImages.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <span>รูปภาพที่บันทึกไว้ล่าสุดในระบบ ({systemImages.length} รูป):</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {systemImages.slice(0, 6).map((item) => {
                      const isSelected = currentAddress === item.address;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSavedSystemImage(item)}
                          className={`relative rounded-xl overflow-hidden border-2 aspect-square group transition-all cursor-pointer p-0.5 ${
                            isSelected 
                              ? 'border-emerald-500 ring-2 ring-emerald-200' 
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title={`${item.name} (${item.sizeKb} KB)`}
                        >
                          <img
                            src={item.address}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-emerald-600/40 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white font-bold" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: SPECIFY IMAGE URL */}
          {activeTab === 'image_url' && (
            <div className="space-y-3.5 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  กรอกหรือวางที่อยู่รูปภาพ (Image Address / Direct URL):
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <input
                    id="input-avatar-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => handleUrlInputChange(e.target.value)}
                    placeholder="เช่น https://example.com/photo.jpg หรือ ลิงก์รูปภาพออนไลน์"
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>ประเภทที่อยู่รูปภาพที่รองรับ:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                  <li><b>ลิงก์รูปภาพทั่วไป:</b> URL รูปภาพจากอินเทอร์เน็ตที่ลงท้ายด้วย .jpg, .png, .webp หรือ CDN</li>
                  <li><b>Data URL:</b> สตริง Base64 ของรูปภาพที่คัดลอกจากระบบอื่น</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM PRESET AVATARS */}
          {activeTab === 'system_presets' && (
            <div className="space-y-3.5 mb-4">
              <p className="text-xs text-slate-600 font-medium">
                เลือกรูปโปรไฟล์ทางการสำหรับบุคลากรทางการศึกษาและนักเรียน:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                {SYSTEM_PRESET_AVATARS.map((preset) => {
                  const isSelected = currentAddress === preset.address;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2 rounded-xl border text-left flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-200' 
                          : 'border-slate-200 hover:border-purple-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                        <img
                          src={preset.address}
                          alt={preset.label}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white font-bold" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 text-center leading-tight line-clamp-2">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 gap-2">
          
          <div className="flex items-center gap-1.5">
            {currentAddress && (
              <button
                type="button"
                onClick={handleCopyImageAddress}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="คัดลอกที่อยู่รูปภาพ"
              >
                {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedAddress ? 'คัดลอกแล้ว' : 'คัดลอกที่อยู่'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              id="btn-apply-avatar"
              type="button"
              onClick={handleApplyAvatar}
              disabled={!currentAddress}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>บันทึกรูปโปรไฟล์เข้าสู่ระบบ</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
