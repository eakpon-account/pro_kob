// In-System Image Storage & Image Address Management Service

export interface SystemImageItem {
  id: string;
  name: string;
  address: string; // Direct Image Address (Data URL or Web URL)
  sizeKb: number;
  width: number;
  height: number;
  mimeType: string;
  uploadedAt: string;
  usedBy?: string;
}

const STORAGE_KEY = 'school_grading_system_images_v2';

// Standard System Preset Avatars
export const SYSTEM_PRESET_AVATARS: { id: string; label: string; address: string; category: string }[] = [
  {
    id: 'preset-teacher-1',
    label: 'ครูประจำวิชา (ชาย - ทางการ)',
    address: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    category: 'ครูและอาจารย์'
  },
  {
    id: 'preset-teacher-2',
    label: 'ครูประจำวิชา (หญิง - อบอุ่น)',
    address: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    category: 'ครูและอาจารย์'
  },
  {
    id: 'preset-teacher-3',
    label: 'ครูคณิตศาสตร์ / วิทยาศาสตร์',
    address: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    category: 'ครูและอาจารย์'
  },
  {
    id: 'preset-teacher-4',
    label: 'ครูภาษาไทย / ภาษาต่างประเทศ',
    address: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=300&auto=format&fit=crop&q=80',
    category: 'ครูและอาจารย์'
  },
  {
    id: 'preset-admin-1',
    label: 'ผู้บริหาร / ผู้อำนวยการ',
    address: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80',
    category: 'ฝ่ายบริหาร'
  },
  {
    id: 'preset-staff-1',
    label: 'เจ้าหน้าที่ทะเบียนและวัดผล',
    address: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80',
    category: 'เจ้าหน้าที่'
  },
  {
    id: 'preset-student-male',
    label: 'นักเรียนชาย',
    address: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    category: 'นักเรียน'
  },
  {
    id: 'preset-student-female',
    label: 'นักเรียนหญิง',
    address: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    category: 'นักเรียน'
  },
];

class ImageStorageService {
  // Compress & store image directly into system
  public async processAndStoreImage(
    file: File, 
    customName?: string, 
    maxWidth = 450, 
    maxHeight = 450, 
    quality = 0.85
  ): Promise<SystemImageItem> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawData = e.target?.result as string;
        if (!rawData) {
          return reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
        }

        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              return reject(new Error('เบราว์เซอร์ไม่รองรับการประมวลผล Canvas'));
            }

            // High quality smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const mimeType = 'image/jpeg';
            const dataUrl = canvas.toDataURL(mimeType, quality);
            
            // Calculate approximate size in KB
            const head = 'data:image/jpeg;base64,';
            const sizeInBytes = Math.round(((dataUrl.length - head.length) * 3) / 4);
            const sizeKb = Number((sizeInBytes / 1024).toFixed(1));

            const cleanFileName = customName || file.name || `image_${Date.now()}.jpg`;
            const imageItem: SystemImageItem = {
              id: `sys-img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: cleanFileName,
              address: dataUrl,
              sizeKb: sizeKb > 0 ? sizeKb : Number((dataUrl.length / 1024).toFixed(1)),
              width,
              height,
              mimeType,
              uploadedAt: new Date().toISOString(),
            };

            this.saveImageRecord(imageItem);
            resolve(imageItem);
          } catch (err: any) {
            reject(err);
          }
        };

        img.onerror = () => reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพที่ถูกต้อง'));
        img.src = rawData;
      };

      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการโหลดไฟล์'));
      reader.readAsDataURL(file);
    });
  }

  // Get all images stored in system
  public getSystemImages(): SystemImageItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Save single record
  public saveImageRecord(item: SystemImageItem): void {
    try {
      const list = this.getSystemImages();
      // Keep recent 30 images to keep local storage fast
      const updated = [item, ...list.filter(i => i.id !== item.id)].slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not cache system image record in localStorage:', e);
    }
  }

  // Delete image from system records
  public deleteImageRecord(id: string): void {
    try {
      const list = this.getSystemImages();
      const updated = list.filter(i => i.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not delete system image record:', e);
    }
  }

  // Copy Image Address / URL to clipboard
  public async copyAddress(address: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(address);
        return true;
      } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (err) {
      console.error('Failed to copy image address:', err);
      return false;
    }
  }

  // Helper to describe an address
  public describeAddress(address?: string): {
    isDataUrl: boolean;
    isHttp: boolean;
    typeLabel: string;
    shortDisplay: string;
  } {
    if (!address) {
      return {
        isDataUrl: false,
        isHttp: false,
        typeLabel: 'ไม่มีที่อยู่รูปภาพ',
        shortDisplay: 'ไม่มีที่อยู่รูปภาพ',
      };
    }

    if (address.startsWith('data:image/')) {
      const format = address.split(';')[0].replace('data:image/', '').toUpperCase();
      const charCount = address.length;
      return {
        isDataUrl: true,
        isHttp: false,
        typeLabel: `จัดเก็บในระบบโดยตรง (System Data URL - ${format})`,
        shortDisplay: `data:image/${format.toLowerCase()};base64,... (${(charCount / 1024).toFixed(1)} KB)`,
      };
    }

    if (address.startsWith('http://') || address.startsWith('https://')) {
      let domain = '';
      try {
        domain = new URL(address).hostname;
      } catch {
        domain = 'Web Link';
      }
      return {
        isDataUrl: false,
        isHttp: true,
        typeLabel: `ลิงก์เว็บไซต์ภายนอก (${domain})`,
        shortDisplay: address,
      };
    }

    return {
      isDataUrl: false,
      isHttp: false,
      typeLabel: 'ที่อยู่รูปภาพระบบ',
      shortDisplay: address,
    };
  }

  /**
   * Helper to normalize pasted image URLs (including Drive or Cloud image links) to direct embed format
   */
  public resolveDirectImageUrl(inputUrl: string): string {
    if (!inputUrl) return '';
    const trimmed = inputUrl.trim();
    
    // Drive links converter helper for backwards compatibility with user pasted links
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    if (fileIdMatch && fileIdMatch[1] && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    
    return trimmed;
  }
}

export const imageStorage = new ImageStorageService();
