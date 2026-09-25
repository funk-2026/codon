import { explainUploadFailure, mimeFromName, normalizeMime, planImage, type MediaLimits } from '../plan';

const lim: MediaLimits = { max_bytes: 5_000_000, max_dimension: 4000, allowed_mimes: ['image/jpeg', 'image/png', 'image/webp'] };

describe('planImage', () => {
  it('keeps an image already within limits', () => {
    expect(planImage({ width: 1200, height: 800, bytes: 300_000, mime: 'image/jpeg' }, lim)).toEqual({ action: 'keep' });
  });
  it('rejects unsupported types (GIF, PDF)', () => {
    expect(planImage({ width: 10, height: 10, bytes: 10, mime: 'image/gif' }, lim).action).toBe('reject');
    expect(planImage({ width: 10, height: 10, bytes: 10, mime: 'application/pdf' }, lim).action).toBe('reject');
  });
  it('converts iPhone HEIC to JPEG instead of rejecting it', () => {
    expect(planImage({ width: 4032, height: 3024, bytes: 2_000_000, mime: 'image/heic' }, lim)).toMatchObject({ action: 'resize', format: 'jpeg', width: 3600 });
  });
  it('treats image/jpg as jpeg', () => {
    expect(normalizeMime('IMAGE/JPG')).toBe('image/jpeg');
    expect(planImage({ width: 100, height: 100, bytes: 100, mime: 'image/jpg' }, lim)).toEqual({ action: 'keep' });
  });
  it('shrinks over-wide landscape images to the cap (width-bound)', () => {
    const p = planImage({ width: 8000, height: 6000, bytes: 4_000_000, mime: 'image/jpeg' }, lim);
    expect(p).toMatchObject({ action: 'resize', width: 4000, format: 'jpeg' });
    expect((p as any).height).toBeUndefined();
  });
  it('shrinks over-tall portrait images (height-bound)', () => {
    const p = planImage({ width: 3000, height: 9000, bytes: 4_000_000, mime: 'image/jpeg' }, lim);
    expect(p).toMatchObject({ action: 'resize', height: 4000 });
    expect((p as any).width).toBeUndefined();
  });
  it('compresses an over-size photo that is within the dimension cap', () => {
    const p = planImage({ width: 3000, height: 2000, bytes: 9_000_000, mime: 'image/jpeg' }, lim);
    expect(p).toMatchObject({ action: 'resize', width: 1800, compress: 0.8 });
  });
  it('keeps a diagram PNG as PNG when only the dimensions are the problem', () => {
    expect(planImage({ width: 6000, height: 3000, bytes: 1_000_000, mime: 'image/png' }, lim)).toMatchObject({ action: 'resize', format: 'png' });
  });
  it('converts an over-size PNG to JPEG', () => {
    expect(planImage({ width: 3000, height: 2000, bytes: 9_000_000, mime: 'image/png' }, lim)).toMatchObject({ format: 'jpeg' });
  });
});

describe('mimeFromName', () => {
  it('maps extensions, ignoring query strings', () => {
    expect(mimeFromName('file:///a/b/photo.JPG?x=1')).toBe('image/jpeg');
    expect(mimeFromName('x.png')).toBe('image/png');
    expect(mimeFromName('x.HEIC')).toBe('image/heic');
    expect(mimeFromName('noext')).toBe('application/octet-stream');
  });
});

describe('explainUploadFailure', () => {
  it('permanent vs retryable', () => {
    expect(explainUploadFailure('too_large').retryable).toBe(false);
    expect(explainUploadFailure('corrupt_image').retryable).toBe(false);
    expect(explainUploadFailure(undefined).retryable).toBe(true);
    expect(explainUploadFailure(undefined, 429).code).toBe('rate_limited');
    expect(explainUploadFailure('storage_unavailable').retryable).toBe(true);
  });
});
