import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sonate-ivory">
      <div className="bg-sonate-ivory-light rounded-xl shadow-sm border border-sonate-cream-border p-8 w-full max-w-sm space-y-4">
        <Image
          src="/brand/sonate-logo-vert.png"
          alt="Sonate, votre croissance est clé"
          width={200}
          height={60}
          priority
          className="mx-auto mb-6 h-auto w-[200px]"
        />
        <h1 className="text-xl font-semibold text-center text-sonate-green">Mot de passe oublié</h1>
        <p className="text-sm text-sonate-ink/80 text-center">
          Pour réinitialiser votre mot de passe, contactez un administrateur de votre espace.
        </p>
        <Link
          href="/login"
          className="block text-center text-sm text-sonate-ink underline underline-offset-2 hover:opacity-80"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
