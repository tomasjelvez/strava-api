"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CommunityProfileCard() {
  const [identifiesAsWoman, setIdentifiesAsWoman] = useState(false);
  const [profilePublic, setProfilePublic] = useState(true);
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/profile", { cache: "no-store" });
      const payload = res.ok ? await res.json().catch(() => ({})) : {};
      const p = payload.profile ?? {};
      setIdentifiesAsWoman(!!p.identifiesAsWoman);
      setProfilePublic(p.profilePublic !== false);
      setSkill(
        typeof p.declaredSkillBand === "string" ? p.declaredSkillBand : ""
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifiesAsWoman,
          profilePublic,
          declaredSkillBand:
            skill === ""
              ? null
              : skill,
        }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Perfil para eventos de la comunidad
        </CardTitle>
        <CardDescription>
          Datos declarados por vos para salidas solo mujeres y contexto para
          anfitriones. Podés elegir si tu bitácora es visible para otras personas
          con sesión iniciada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-5">
        {loading ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input"
                checked={identifiesAsWoman}
                onChange={(e) => setIdentifiesAsWoman(e.target.checked)}
              />
              <span>
                Me identifico como mujer — necesario para anotarte en salidas solo
                mujeres.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input"
                checked={profilePublic}
                onChange={(e) => setProfilePublic(e.target.checked)}
              />
              <span>
                Mostrar mi bitácora a otras personas con sesión iniciada.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Nivel declarado (opcional, orientación para anfitriones)
              <select
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal"
              >
                <option value="">Prefiero no decir</option>
                <option value="CASUAL">Principiante / suave</option>
                <option value="INTERMEDIATE">Intermedio</option>
                <option value="ADVANCED">Avanzado</option>
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              className="w-full sm:w-auto self-start"
              onClick={() => void save()}
            >
              Guardar ajustes de comunidad
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
