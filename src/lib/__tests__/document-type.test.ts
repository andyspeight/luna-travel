import { describe, it, expect } from 'vitest';
import { IMAGE_EXTS, extOf, mimeFromName } from '@/lib/document-type';

describe('extOf', () => {
  it('trusts a declared MIME type over the filename', () => {
    // Travelify hands back names like "ticket.bin" with a correct header.
    expect(extOf('ticket.bin', 'application/pdf')).toBe('pdf');
    expect(extOf('voucher.pdf', 'image/png')).toBe('png');
  });

  it('accepts a MIME type with parameters', () => {
    expect(extOf('x', 'application/pdf; charset=binary')).toBe('pdf');
  });

  it('falls back to the filename when there is no MIME type', () => {
    expect(extOf('booking-pack.PDF')).toBe('pdf');
    expect(extOf('park-ticket.JPG')).toBe('jpg');
  });

  it('reads the extension off a URL, ignoring query and fragment', () => {
    expect(extOf('https://files.example.com/a/b/eticket.pdf?sig=abc&x=1')).toBe('pdf');
    expect(extOf('https://files.example.com/pass.png#page=2')).toBe('png');
  });

  it('gives one spelling per format', () => {
    // jpeg/jpg and tif/tiff must not look like two different things to the
    // viewer picker and the download filename.
    expect(extOf('a.jpeg')).toBe('jpg');
    expect(extOf('a', 'image/jpeg')).toBe('jpg');
    expect(extOf('a.tif')).toBe('tiff');
    expect(extOf('a.heif')).toBe('heic');
  });

  it('defaults to pdf when it has nothing to go on', () => {
    // Travel documents are overwhelmingly PDFs, and the PDF viewer degrades to
    // a readable "couldn't load" rather than a broken image icon.
    expect(extOf('')).toBe('pdf');
    expect(extOf('no-extension-here')).toBe('pdf');
    // octet-stream says nothing, so the filename is all there is.
    expect(extOf('booking', 'application/octet-stream')).toBe('pdf');
  });

  it('keeps an extension it does not recognise', () => {
    // Agencies upload spreadsheets and Word documents too. Renaming one .pdf
    // would hand the traveller a file their phone refuses to open.
    expect(extOf('itinerary.docx')).toBe('docx');
    expect(extOf('passengers.csv')).toBe('csv');
  });

  it('does not mistake a dotted path segment for an extension', () => {
    expect(extOf('https://cdn.example.com/2026.05.23/ticket.pdf')).toBe('pdf');
  });
});

describe('IMAGE_EXTS', () => {
  it('routes image documents away from PDF.js', () => {
    // The Orlando case: JPEG park tickets used to be fed to PDF.js and failed.
    expect(IMAGE_EXTS.has(extOf('universal-ticket.jpg'))).toBe(true);
    expect(IMAGE_EXTS.has(extOf('scan', 'image/png'))).toBe(true);
    expect(IMAGE_EXTS.has(extOf('booking-pack.pdf'))).toBe(false);
  });
});

describe('mimeFromName', () => {
  it('is the inverse of extOf for every type we serve', () => {
    expect(mimeFromName('a.pdf')).toBe('application/pdf');
    expect(mimeFromName('a.jpg')).toBe('image/jpeg');
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromName('a.png')).toBe('image/png');
    expect(mimeFromName('a.webp')).toBe('image/webp');
    expect(mimeFromName('a.gif')).toBe('image/gif');
    expect(mimeFromName('a.heic')).toBe('image/heic');
    expect(mimeFromName('a.tiff')).toBe('image/tiff');
  });

  it('calls an unknown file a PDF rather than octet-stream', () => {
    // nosniff means whatever the proxy says is final, so octet-stream would
    // stop a perfectly good PDF from ever previewing.
    expect(mimeFromName('mystery')).toBe('application/pdf');
  });
});
