import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'fund-facts';

/**
 * Merges fund fact PDFs from Supabase Storage into the main report PDF.
 * Fund PDFs are appended after the main report pages, in the order of fundCodes.
 * Individual fund PDF failures are skipped gracefully.
 */
export async function mergeFundPdfs(
  mainPdfBuffer: Buffer | Uint8Array,
  fundCodes: string[],
): Promise<Uint8Array> {
  if (fundCodes.length === 0) {
    return new Uint8Array(mainPdfBuffer);
  }

  const supabase = createClient();

  // Fetch file_path for each fund code from fund_documents table
  const { data: fundDocs } = await supabase
    .from('fund_documents')
    .select('fund_code, file_path')
    .in('fund_code', fundCodes);

  if (!fundDocs || fundDocs.length === 0) {
    return new Uint8Array(mainPdfBuffer);
  }

  const pathMap = new Map<string, string>();
  for (const doc of fundDocs) {
    pathMap.set(doc.fund_code, doc.file_path);
  }

  // Download fund PDFs in parallel, preserving holdings order
  const downloadPromises = fundCodes
    .filter(code => pathMap.has(code))
    .map(async (code) => {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .download(pathMap.get(code)!);
        if (error || !data) {
          console.warn(`[MergeFundPdfs] Failed to download ${code}:`, error);
          return null;
        }
        return { code, buffer: Buffer.from(await data.arrayBuffer()) };
      } catch (err) {
        console.warn(`[MergeFundPdfs] Error downloading ${code}:`, err);
        return null;
      }
    });

  const fundPdfResults = (await Promise.all(downloadPromises)).filter(
    (r) => r !== null
  ) as { code: string; buffer: Buffer }[];

  if (fundPdfResults.length === 0) {
    return new Uint8Array(mainPdfBuffer);
  }

  // Merge using pdf-lib
  const mergedPdf = await PDFDocument.load(mainPdfBuffer);

  for (const result of fundPdfResults) {
    try {
      const fundPdf = await PDFDocument.load(result.buffer);
      const pages = await mergedPdf.copyPages(fundPdf, fundPdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch (err) {
      console.warn(`[MergeFundPdfs] Failed to parse/merge PDF for ${result.code}:`, err);
    }
  }

  return mergedPdf.save();
}
