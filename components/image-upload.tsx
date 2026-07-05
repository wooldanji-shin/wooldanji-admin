'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface UploadedFile {
  url: string;
  fileName: string;
  originalFileName?: string; // 원본 파일명 (한글 포함)
  fileType: string;
  uploadedAt: number;
}

interface ImageUploadProps {
  /**
   * Supabase Storage 버킷 이름 (기본값: 'home-content')
   */
  bucket?: string;
  /**
   * Supabase Storage 경로 (예: 'categories/icons', 'advertisers/logos')
   */
  storagePath: string;
  /**
   * 현재 업로드된 파일 URL (단일 파일 모드용)
   */
  value?: string | null;
  /**
   * 파일 업로드 완료 시 호출되는 콜백 (단일 파일 모드용)
   */
  onChange: (url: string) => void;
  /**
   * 업로드 가능한 파일 형식 (기본값: image/*)
   */
  accept?: string;
  /**
   * 최대 파일 크기 (MB, 기본값: 10)
   */
  maxSizeMB?: number;
  /**
   * 설명 텍스트
   */
  description?: string;
  /**
   * 여러 파일 업로드 허용 여부 (기본값: false)
   */
  multiple?: boolean;
}

// 파일명 정리 (ASCII만 허용 - Supabase Storage 제약)
function sanitizeFileName(fileName: string): string {
  // 영문, 숫자, 하이픈, 언더스코어만 남김
  let sanitized = fileName
    .replace(/\s+/g, '_') // 공백은 언더스코어로
    .replace(/\.+/g, '_') // 점도 언더스코어로
    .replace(/[^A-Za-z0-9_-]/g, '') // ASCII 영문, 숫자, _, - 만 남김
    .replace(/_{2,}/g, '_') // 연속된 언더스코어는 하나로
    .replace(/-{2,}/g, '-') // 연속된 하이픈은 하나로
    .replace(/^[_-]+|[_-]+$/g, ''); // 앞뒤 언더스코어/하이픈 제거

  // 빈 문자열이면 'file'로
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'file';
  }

  // 너무 길면 자르기 (최대 40자)
  if (sanitized.length > 40) {
    sanitized = sanitized.substring(0, 40);
  }

  return sanitized;
}

export function ImageUpload({
  bucket = 'home-content',
  storagePath,
  value,
  onChange,
  accept = 'image/*',
  maxSizeMB = 10,
  description,
  multiple = false,
}: ImageUploadProps) {
  const supabase = createClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    // 초기값 설정
    if (value) {
      try {
        const url = new URL(value.split('?')[0]);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        return [{
          url: value,
          fileName: decodeURIComponent(fileName),
          originalFileName: undefined, // 초기 로드 시에는 원본 파일명 없음
          fileType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/*',
          uploadedAt: Date.now(),
        }];
      } catch {
        return [];
      }
    }
    return [];
  });

  // 이미지 비율 체크 함수 (1:1, 3:4, 2:3 허용, ±5% 허용치)
  const checkImageRatio = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const ratio = img.width / img.height;

          // 1:1 비율 체크 (0.95 ~ 1.05)
          const isSquare = ratio >= 0.95 && ratio <= 1.05;

          // 3:4 비율 체크 세로 (0.714 ~ 0.789)
          const is3to4Portrait = ratio >= 0.714 && ratio <= 0.789;

          // 2:3 비율 체크 세로 (0.633 ~ 0.700)
          const is2to3Portrait = ratio >= 0.633 && ratio <= 0.700;

          if (isSquare || is3to4Portrait || is2to3Portrait) {
            resolve();
          } else {
            // 추천 크기 계산
            let recommendations = '';

            // 1:1 정사각형 추천
            const squareSize = Math.min(img.width, img.height);
            recommendations += `\n\n추천 크기:\n`;
            recommendations += `• 1:1 (정사각형): ${squareSize} x ${squareSize}\n`;

            // 2:3 세로 추천 (가로 기준)
            const height2to3FromWidth = Math.round(img.width * 3 / 2);
            recommendations += `• 2:3 (세로, 가로 기준): ${img.width} x ${height2to3FromWidth}\n`;

            // 2:3 세로 추천 (세로 기준)
            const width2to3FromHeight = Math.round(img.height * 2 / 3);
            recommendations += `• 2:3 (세로, 세로 기준): ${width2to3FromHeight} x ${img.height}\n`;

            // 3:4 세로 추천 (가로 기준)
            const height3to4FromWidth = Math.round(img.width * 4 / 3);
            recommendations += `• 3:4 (세로, 가로 기준): ${img.width} x ${height3to4FromWidth}\n`;

            // 3:4 세로 추천 (세로 기준)
            const width3to4FromHeight = Math.round(img.height * 3 / 4);
            recommendations += `• 3:4 (세로, 세로 기준): ${width3to4FromHeight} x ${img.height}`;

            reject(new Error(
              `이미지 비율이 맞지 않습니다.\n` +
              `허용 비율: 1:1 (정사각형), 2:3 (세로), 3:4 (세로)\n` +
              `현재 이미지: ${img.width} x ${img.height} (비율: ${ratio.toFixed(2)}:1)` +
              recommendations
            ));
          }
        };

        img.onerror = () => {
          reject(new Error('이미지를 로드할 수 없습니다.'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('파일을 읽을 수 없습니다.'));
      };

      reader.readAsDataURL(file);
    });
  };

  // 이미지를 WebP로 변환하는 함수 (긴 변 1920px 리사이징 + 95% 품질)
  const convertToWebP = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');

          // 최대 크기 제한 (긴 쪽 기준)
          const MAX_SIZE = 1920; // 레티나 디스플레이 대응
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 크기 조절
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          // 고품질 렌더링 설정
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('WebP 변환에 실패했습니다.'));
              }
            },
            'image/webp',
            0.95 // 고품질 유지 (95%)
          );
        };

        img.onerror = () => {
          reject(new Error('이미지를 로드할 수 없습니다.'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('파일을 읽을 수 없습니다.'));
      };

      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (file: File) => {
    setError(null);

    try {
      // 이미지 파일인지 확인 (jpg, jpeg, png는 webp로 변환)
      const isImageFile = file.type.startsWith('image/');

      // 파일명 처리: 원본파일명_타임스탬프.확장자
      const timestamp = Date.now();
      const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
      const sanitizedName = sanitizeFileName(originalName);

      const shouldConvertToWebP = isImageFile &&
        (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg');

      let fileToUpload: File | Blob = file;
      let fileExt = file.name.split('.').pop();
      let contentType = file.type;

      // WebP로 변환
      if (shouldConvertToWebP) {
        console.log('🔄 [ImageUpload] WebP로 변환 중...', { original: file.name });
        const webpBlob = await convertToWebP(file);
        fileToUpload = webpBlob;
        fileExt = 'webp';
        contentType = 'image/webp';

        const sizeDiff = ((1 - webpBlob.size / file.size) * 100).toFixed(1);
        console.log('✅ [ImageUpload] WebP 변환 완료', {
          원본크기: `${(file.size / 1024).toFixed(2)}KB`,
          변환후크기: `${(webpBlob.size / 1024).toFixed(2)}KB`,
          감소율: `${sizeDiff}%`,
          품질: '95%',
          최대크기: '1920px (긴 변 기준)',
        });
      }

      const fullFileName = `${sanitizedName}_${timestamp}.${fileExt}`;
      const filePath = `${storagePath}/${fullFileName}`;

      console.log('🔵 [ImageUpload] 파일 업로드', {
        original: file.name,
        sanitized: sanitizedName,
        fullFileName,
        filePath,
        converted: shouldConvertToWebP,
      });

      // 파일 업로드
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileToUpload, {
          upsert: false,
          contentType: contentType,
        });

      if (uploadError) {
        console.error('🔴 [ImageUpload] 업로드 에러', uploadError);
        throw uploadError;
      }

      console.log('🔵 [ImageUpload] 업로드 성공', data);

      // Public URL 생성
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const uploadedFile: UploadedFile = {
        url: publicUrl,
        fileName: fullFileName,
        originalFileName: file.name, // 원본 파일명 저장 (한글 포함)
        fileType: contentType,
        uploadedAt: timestamp,
      };

      if (multiple) {
        setUploadedFiles(prev => [...prev, uploadedFile]);
      } else {
        // 단일 파일 모드: 기존 파일이 있으면 삭제
        if (uploadedFiles.length > 0) {
          await handleRemove(uploadedFiles[0].url);
        }
        setUploadedFiles([uploadedFile]);
      }

      onChange(publicUrl);

      console.log('🟢 [ImageUpload] uploadFile 완료', { publicUrl });
    } catch (err: any) {
      console.error('🔴 [ImageUpload] Upload error:', err);
      setError(err.message || '업로드에 실패했습니다.');
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      setIsUploading(true);

      if (multiple) {
        // 여러 파일을 순차적으로 업로드
        for (const file of files) {
          await uploadFile(file);
        }
      } else {
        // 단일 파일만 업로드
        await uploadFile(files[0]);
      }

      setIsUploading(false);
    },
    [multiple, uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    if (multiple) {
      // 여러 파일을 순차적으로 업로드
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i]);
      }
    } else {
      // 단일 파일만 업로드
      await uploadFile(files[0]);
    }

    setIsUploading(false);

    // input 초기화
    e.target.value = '';
  };

  const handleRemove = async (url: string) => {
    try {
      // URL에서 파일 경로 추출
      const urlObj = new URL(url.split('?')[0]);
      const pathParts = urlObj.pathname.split('/');
      // storage/v1/object/public/bucket/path/file.ext에서 path/file.ext 추출
      const bucketIndex = pathParts.indexOf(bucket);
      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      console.log('🔴 [ImageUpload] 파일 삭제', { url, filePath });

      await supabase.storage.from(bucket).remove([filePath]);

      setUploadedFiles(prev => prev.filter(f => f.url !== url));

      // 단일 파일 모드면 onChange 호출
      if (!multiple) {
        onChange('');
      }
    } catch (err) {
      console.error('Remove error:', err);
      setError('파일 삭제에 실패했습니다.');
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      // fetch로 파일을 가져온 후 Blob으로 다운로드
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Blob URL 해제
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      // 실패하면 새 탭에서 열기
      window.open(url, '_blank');
    }
  };

  const isPDF = (fileType: string) => fileType.includes('pdf');
  const isImage = (fileType: string) => fileType.startsWith('image/');

  return (
    <div className='space-y-2'>
      {description && (
        <p className='text-xs text-muted-foreground'>{description}</p>
      )}

      {error && (
        <p className='text-xs text-destructive'>{error}</p>
      )}

      {/* 파일이 없을 때: 업로드 영역 표시 */}
      {uploadedFiles.length === 0 && (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg transition-colors py-4 px-6',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            isUploading && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <label
            htmlFor={`upload-${storagePath}`}
            className='flex items-center gap-4 cursor-pointer'
          >
            {isUploading ? (
              <>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-primary flex-shrink-0' />
                <span className='text-sm text-muted-foreground'>업로드 중...</span>
              </>
            ) : (
              <>
                <Upload className='h-6 w-6 text-muted-foreground flex-shrink-0' />
                <div className='flex-1'>
                  <p className='text-sm font-medium text-foreground'>
                    클릭하거나 파일을 드래그하여 업로드
                  </p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    {accept === 'image/*' ? '이미지 파일만' : accept === 'image/*,application/pdf' ? '이미지 또는 PDF' : '파일'}
                    {maxSizeMB && ` (최대 ${maxSizeMB}MB)`}
                  </p>
                </div>
              </>
            )}
            <input
              id={`upload-${storagePath}`}
              type='file'
              className='hidden'
              accept={accept}
              onChange={handleFileInput}
              disabled={isUploading}
              multiple={multiple}
            />
          </label>
        </div>
      )}

      {/* 파일이 있을 때: 업로드된 파일 목록 표시 */}
      {uploadedFiles.length > 0 && (
        <div className='space-y-2'>
          {uploadedFiles.map((file) => {
            const cleanUrl = file.url.split('?')[0];
            // 원본 파일명이 있으면 사용, 없으면 Storage 파일명 사용
            const nameToDisplay = file.originalFileName || file.fileName;
            const displayName = nameToDisplay.length > 50
              ? nameToDisplay.substring(0, 47) + '...'
              : nameToDisplay;

            return (
              <div
                key={file.url}
                className='flex gap-4 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors'
              >
                {/* 왼쪽: 파일 아이콘/썸네일 */}
                <div className='flex-shrink-0'>
                  {isPDF(file.fileType) ? (
                    <div className='w-16 h-16 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center'>
                      <FileText className='h-6 w-6 text-red-600 dark:text-red-400' />
                    </div>
                  ) : isImage(file.fileType) ? (
                    <div className='w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center relative'>
                      <img
                        src={cleanUrl}
                        alt={nameToDisplay}
                        className='w-full h-full object-cover'
                        onError={(e) => {
                          // 이미지 로딩 실패 시 아이콘으로 대체
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const icon = document.createElement('div');
                            icon.className = 'flex items-center justify-center w-full h-full';
                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className='w-16 h-16 rounded-lg bg-muted flex items-center justify-center'>
                      <ImageIcon className='h-6 w-6 text-muted-foreground' />
                    </div>
                  )}
                </div>

                {/* 오른쪽: 파일 정보와 액션 버튼 */}
                <div className='flex-1 min-w-0 flex flex-col justify-between gap-2'>
                  {/* 상단: 파일 정보 */}
                  <div>
                    <p className='text-sm font-medium truncate' title={nameToDisplay}>
                      {displayName}
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {new Date(file.uploadedAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* 하단: 액션 버튼들 */}
                  <div className='flex items-center gap-1'>
                    {/* 미리보기/열기 버튼 */}
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => window.open(cleanUrl, '_blank')}
                      className='h-8 px-3'
                      title={isPDF(file.fileType) ? 'PDF 열기' : '이미지 보기'}
                    >
                      {isPDF(file.fileType) ? '열기' : '보기'}
                    </Button>

                    {/* 다운로드 버튼 */}
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => handleDownload(cleanUrl, nameToDisplay)}
                      className='h-8 w-8 p-0'
                      title='다운로드'
                    >
                      <Download className='h-4 w-4' />
                    </Button>

                    {/* 삭제 버튼 */}
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => handleRemove(file.url)}
                      className='h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive'
                      title='삭제'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 여러 파일 모드일 때: 파일 추가 버튼 */}
          {multiple && (
            <div
              className={cn(
                'relative border-2 border-dashed rounded-lg transition-colors py-3 px-6',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
                isUploading && 'opacity-50 pointer-events-none'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <label
                htmlFor={`upload-${storagePath}`}
                className='flex items-center gap-3 cursor-pointer'
              >
                <Upload className='h-5 w-5 text-muted-foreground flex-shrink-0' />
                <span className='text-sm text-muted-foreground'>파일 추가</span>
                <input
                  id={`upload-${storagePath}`}
                  type='file'
                  className='hidden'
                  accept={accept}
                  onChange={handleFileInput}
                  disabled={isUploading}
                  multiple={multiple}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
