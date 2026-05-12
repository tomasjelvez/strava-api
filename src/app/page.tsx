import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/events");
  }

  return (
    <main className="bg-muted/40 flex min-h-screen flex-col px-4 py-16 sm:px-6 lg:items-center lg:justify-center lg:px-8 lg:py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Draft
          </p>
          <h1 className="font-heading text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Organiza juntas y revive cada salida.
          </h1>
          <p className="text-muted-foreground max-w-md text-pretty text-lg leading-relaxed">
            Crea eventos, confirma asistencia, comparte fotos y deja comentarios
            con la comunidad después de cada encuentro.
          </p>
        </div>

        <div className="bg-card flex w-full max-w-md flex-col gap-3 rounded-2xl border p-6 shadow-sm ring-1 ring-foreground/5 sm:flex-row sm:justify-center sm:p-5">
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "flex-1 sm:flex-none"
            )}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "flex-1 border-dashed sm:flex-none"
            )}
          >
            Crear cuenta
          </Link>
        </div>

        <p className="text-muted-foreground text-xs">
          Al entrar vas directo a{" "}
          <span className="text-foreground font-medium">Eventos</span> para ver
          las próximas juntas de la comunidad.
        </p>
      </div>
    </main>
  );
}
