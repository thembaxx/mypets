import { overviewMarkdown, textResponse } from '@/lib/discovery';
export const dynamic = 'force-static';
export function GET() {
  return textResponse(overviewMarkdown());
}
