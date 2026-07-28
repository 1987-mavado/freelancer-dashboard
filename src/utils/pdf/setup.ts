import * as pdfMake from 'pdfmake'
import vfs from 'pdfmake/build/vfs_fonts'

pdfMake.addVirtualFileSystem(vfs)

export { pdfMake }

export async function downloadPdf(
  docDefinition: Parameters<typeof pdfMake.createPdf>[0],
  filename: string,
) {
  await pdfMake.createPdf(docDefinition).download(filename)
}
