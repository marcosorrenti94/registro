/**
 * Caricamento pigro di exceljs (libreria pesante): viene scaricata solo quando si importa
 * o si esporta un file Excel. Nel browser Vite usa la build "browser" del pacchetto.
 */
export type ExcelJsModule = typeof import('exceljs');

export async function loadExcelJs(): Promise<ExcelJsModule> {
  const mod = (await import('exceljs')) as ExcelJsModule & { default?: ExcelJsModule };
  return mod.default ?? mod;
}
