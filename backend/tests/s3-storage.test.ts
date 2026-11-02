import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
const uploadDone = vi.fn();
const uploadOn = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: 'put' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: 'delete' })),
  DeleteObjectsCommand: vi.fn().mockImplementation((input) => ({ input, type: 'deleteMany' })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: 'head' })),
}));

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn().mockImplementation(() => ({
    on: uploadOn,
    done: uploadDone,
  })),
}));

vi.mock('../config', () => ({
  env: {
    s3Configured: true,
    AWS_REGION: 'us-east-1',
    AWS_S3_BUCKET: 'ifsmhp-media-test',
    AWS_CLOUDFRONT_URL: 'https://cdn.example.test',
    AWS_S3_KEY_PREFIX: 'ifsmhp',
    AWS_S3_MULTIPART_THRESHOLD_MB: 1,
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
    isProduction: false,
    isTest: true,
  },
}));

describe('s3-storage.service', () => {
  beforeEach(async () => {
    send.mockReset();
    uploadDone.mockReset();
    uploadOn.mockReset();
    uploadDone.mockResolvedValue({ ETag: '"etag-multi"' });
    send.mockResolvedValue({ ETag: '"etag-put"' });
    const mod = await import('../services/s3-storage.service');
    mod.resetS3ClientForTests();
  });

  it('returns a CloudFront URL and uses PutObject for small buffers', async () => {
    const { uploadBuffer, CDN_CACHE_CONTROL } = await import('../services/s3-storage.service');
    const result = await uploadBuffer(Buffer.from('tiny'), 'award-event-media/demo.jpg', 'image/jpeg');
    expect(result.cdnUrl).toBe('https://cdn.example.test/ifsmhp/award-event-media/demo.jpg');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.cacheControl).toBe(CDN_CACHE_CONTROL);
    expect(result.key).toBe('ifsmhp/award-event-media/demo.jpg');
    expect(send).toHaveBeenCalled();
  });

  it('uses multipart Upload for large buffers', async () => {
    const { Upload } = await import('@aws-sdk/lib-storage');
    const { uploadBuffer } = await import('../services/s3-storage.service');
    const large = Buffer.alloc(1.5 * 1024 * 1024, 1);
    const result = await uploadBuffer(large, 'award-event-media/clip.mp4', 'video/mp4');
    expect(Upload).toHaveBeenCalled();
    expect(uploadDone).toHaveBeenCalled();
    expect(result.cdnUrl).toContain('clip.mp4');
    expect(result.cdnUrl.startsWith('https://cdn.example.test/')).toBe(true);
  });

  it('rejects path traversal in object keys', async () => {
    const { uploadBuffer } = await import('../services/s3-storage.service');
    await expect(uploadBuffer(Buffer.from('x'), '../secret', 'text/plain')).rejects.toMatchObject({ statusCode: 400 });
  });
});
