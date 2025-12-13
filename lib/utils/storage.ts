import { createClient } from '@/lib/supabase/client';

/**
 * Supabase Storage에서 URL로부터 파일을 삭제합니다.
 * @param url - 삭제할 파일의 전체 URL
 * @returns 성공 여부
 */
export async function deleteFileFromStorage(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const supabase = createClient();

    // URL에서 경로 추출
    // 예: https://xyz.supabase.co/storage/v1/object/public/bucket/path/file.jpg
    // -> bucket/path/file.jpg
    const pathname = new URL(url).pathname;
    const pathParts = pathname.split('/').filter(Boolean);

    // 'storage', 'v1', 'object', 'public'을 제거하고 bucket과 파일 경로만 추출
    const storageIndex = pathParts.findIndex(part => part === 'storage');
    if (storageIndex === -1) {
      console.error('Invalid storage URL format:', url);
      return false;
    }

    // storage 이후의 경로에서 bucket과 파일 경로 추출
    const relevantParts = pathParts.slice(storageIndex + 1); // ['v1', 'object', 'public', 'bucket', 'path', 'file.jpg']
    const publicIndex = relevantParts.findIndex(part => part === 'public');
    if (publicIndex === -1) {
      console.error('Invalid storage URL format:', url);
      return false;
    }

    const bucketAndPath = relevantParts.slice(publicIndex + 1); // ['bucket', 'path', 'file.jpg']
    const bucket = bucketAndPath[0];
    const filePath = bucketAndPath.slice(1).join('/');

    if (!bucket || !filePath) {
      console.error('Could not extract bucket or file path from URL:', url);
      return false;
    }

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error('Failed to delete file from storage:', error);
      return false;
    }

    console.log('Successfully deleted file from storage:', filePath);
    return true;
  } catch (err) {
    console.error('Error deleting file from storage:', err);
    return false;
  }
}

/**
 * 여러 파일을 한 번에 삭제합니다.
 * @param urls - 삭제할 파일 URL 배열
 * @returns 성공적으로 삭제된 파일 수
 */
export async function deleteFilesFromStorage(urls: string[]): Promise<number> {
  if (!urls || urls.length === 0) return 0;

  const results = await Promise.all(
    urls.map(url => deleteFileFromStorage(url))
  );

  return results.filter(Boolean).length;
}

/**
 * 폴더 내의 모든 파일을 삭제합니다.
 * @param bucket - 버킷 이름
 * @param folderPath - 삭제할 폴더 경로 (예: 'ads/uuid')
 * @returns 성공 여부
 */
export async function deleteFolderFromStorage(
  bucket: string,
  folderPath: string
): Promise<boolean> {
  if (!bucket || !folderPath) return false;

  try {
    const supabase = createClient();

    // 폴더 내 모든 파일 목록 가져오기
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list(folderPath);

    if (listError) {
      console.error('Failed to list files in folder:', listError);
      return false;
    }

    if (!files || files.length === 0) {
      console.log('No files found in folder:', folderPath);
      return true;
    }

    // 모든 파일 경로 생성
    const filePaths = files.map(file => `${folderPath}/${file.name}`);

    // 모든 파일 삭제
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(filePaths);

    if (removeError) {
      console.error('Failed to delete files from folder:', removeError);
      return false;
    }

    console.log('Successfully deleted folder:', folderPath);
    return true;
  } catch (err) {
    console.error('Error deleting folder from storage:', err);
    return false;
  }
}
