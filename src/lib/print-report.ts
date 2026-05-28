/**
 * Opens a print-friendly report in a new browser tab/window.
 * The report is generated server-side as a complete HTML document
 * with embedded CSS for print formatting.
 *
 * @param type - Report type: 'project-summary' | 'invoice-report' | 'warehouse-report' | 'procurement-report'
 * @param projectId - Optional project ID for project-specific reports
 */
export function openReport(type: string, projectId?: string) {
  const params = new URLSearchParams({ type })
  if (projectId) params.set('projectId', projectId)
  window.open(`/api/reports?${params.toString()}`, '_blank')
}
