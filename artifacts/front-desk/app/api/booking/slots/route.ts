import { NextRequest, NextResponse } from 'next/server';
import { findSlotsInWindow } from '@/lib/calendar';
import { TRACK_CONFIG, type BookingTrack } from '@/lib/scheduling';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const appointmentType = searchParams.get('type') ?? 'new_consult';
  const track           = (searchParams.get('track') ?? 'routine') as BookingTrack;

  const cfg = TRACK_CONFIG[track] ?? TRACK_CONFIG['routine'];

  try {
    const slots = await findSlotsInWindow(appointmentType, cfg.lookaheadDays, cfg.maxSlots);
    return NextResponse.json({
      slots: slots.map(s => ({
        start:           s.start.toISOString(),
        end:             s.end.toISOString(),
        location:        s.location,
        appointmentType: s.appointmentType,
        display:         s.display,
      })),
      autoConfirm: cfg.autoConfirm,
      track,
    });
  } catch (err) {
    console.error('[booking/slots] error:', err);
    return NextResponse.json({ slots: [], autoConfirm: false, track }, { status: 200 });
  }
}
