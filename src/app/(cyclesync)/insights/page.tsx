import { TrendingUp, HeartPulse, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Insight = {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
};

const INSIGHTS: Insight[] = [
  {
    title: "La constancia gana a los picos sueltos",
    body: "Quienes mantienen al menos tres sesiones suaves por semana suelen tolerar mejor los bloques duros, con menos días obligados de descanso. Mirá rachas, no un solo entreno heroico.",
    icon: HeartPulse,
  },
  {
    title: "Importa cómo sube el volumen",
    body: "Si el kilometraje semanal sube más de ~15% semana a semana, sube el riesgo de lesión. Mantené la carga estable una semana antes del próximo salto.",
    icon: TrendingUp,
  },
  {
    title: "Señales de calidad con la FC",
    body: "Si los trote suaves se te van acercando a umbral de frecuencia cardíaca, puede ser falta de recuperación, calor o hidratación. Compará sensación subjetiva vs. FC en varias salidas.",
    icon: Sparkles,
  },
];

export default function InsightsPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Consejos
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Ideas de entrenamiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Lecturas cortas sobre carga, recuperación y ritmo. Aún no son
          personalizadas, pero sirven como guía mientras sumamos analítica.
        </p>
      </header>

      <div className="space-y-3">
        {INSIGHTS.map(({ title, body, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-foreground/5">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-sm font-medium leading-snug">
                  {title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Pronto podremos mostrar gráficos con tus actividades sincronizadas desde
        Strava; por ahora son notas generales de entrenamiento.
      </p>
    </div>
  );
}
