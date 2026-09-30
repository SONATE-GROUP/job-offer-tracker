"use client";

import { useState } from "react";
import { ChevronDown, Filter, Eye, Phone, Download, UserCheck, CheckCircle2, XCircle, PhoneCall, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function AccordionItem({
  section,
  isOpen,
  onToggle,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 bg-sonate-ivory-light">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sonate-orange-dark">{section.icon}</span>
          <span className="font-semibold text-sonate-ink text-base">{section.title}</span>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "text-gray-400 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 text-sm text-gray-700 space-y-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 bg-sonate-green text-sonate-ivory text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "red" | "yellow"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 text-xs font-semibold border",
        color === "green" && "bg-green-50 border-green-300 text-green-800",
        color === "red" && "bg-red-50 border-red-300 text-red-800",
        color === "yellow" && "bg-yellow-50 border-yellow-300 text-yellow-800"
      )}
    >
      {children}
    </span>
  );
}

const sections: Section[] = [
  {
    id: "filters",
    icon: <Filter size={20} />,
    title: "Filtres et tri du tableau",
    content: (
      <div className="space-y-4">
        <p>Le tableau principal offre plusieurs façons de retrouver rapidement les offres qui vous intéressent.</p>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Recherche par mot-clé</p>
          <Step number={1}>
            Utilisez la barre de recherche en haut du tableau pour filtrer les offres par intitulé de poste, entreprise, localisation ou source.
          </Step>
          <Step number={2}>
            La recherche s&apos;applique en temps réel, au fur et à mesure que vous tapez.
          </Step>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Filtre par statut</p>
          <Step number={1}>
            Cliquez sur le bouton <strong>Statut</strong> pour filtrer par statut de contact : <Badge color="yellow">À qualifier</Badge>, <Badge color="green">Contacté</Badge> ou <Badge color="red">Ne pas contacter</Badge>.
          </Step>
          <Step number={2}>
            Vous pouvez sélectionner plusieurs statuts simultanément. Par défaut, toutes les offres sont affichées.
          </Step>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Tri des colonnes</p>
          <Step number={1}>
            Cliquez sur l&apos;en-tête d&apos;une colonne pour trier le tableau selon cette colonne (ex : date de réception, entreprise...).
          </Step>
          <Step number={2}>
            Un second clic inverse l&apos;ordre du tri (croissant → décroissant).
          </Step>
        </div>
      </div>
    ),
  },
  {
    id: "columns",
    icon: <Eye size={20} />,
    title: "Masquer / afficher des colonnes",
    content: (
      <div className="space-y-4">
        <p>
          Vous pouvez personnaliser l&apos;affichage du tableau en choisissant les colonnes visibles, et ajuster leur largeur selon vos besoins.
        </p>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Afficher ou masquer des colonnes</p>
          <Step number={1}>
            Cliquez sur le bouton <strong>Colonnes</strong> (icône en haut à droite du tableau) pour ouvrir le panneau de gestion des colonnes.
          </Step>
          <Step number={2}>
            Cochez ou décochez chaque colonne pour l&apos;afficher ou la masquer.
          </Step>
          <Step number={3}>
            Vos préférences sont automatiquement sauvegardées dans votre navigateur : elles seront conservées à votre prochaine connexion.
          </Step>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Redimensionner les colonnes</p>
          <Step number={1}>
            Positionnez votre curseur sur le bord droit d&apos;un en-tête de colonne jusqu&apos;à voir apparaître la flèche de redimensionnement.
          </Step>
          <Step number={2}>
            Cliquez et faites glisser pour ajuster la largeur de la colonne.
          </Step>
        </div>
      </div>
    ),
  },
  {
    id: "statuses",
    icon: <UserCheck size={20} />,
    title: "Gestion des statuts de contact",
    content: (
      <div className="space-y-4">
        <p>
          Chaque offre dispose d&apos;un statut de contact qui reflète l&apos;avancement de votre traitement. Trois statuts sont disponibles :
        </p>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 border border-yellow-200 bg-yellow-50">
            <Badge color="yellow">À qualifier</Badge>
            <p>Statut par défaut à l&apos;arrivée d&apos;une nouvelle offre. Le lead n&apos;a pas encore été traité.</p>
          </div>
          <div className="flex items-start gap-3 p-3 border border-green-200 bg-green-50">
            <Badge color="green">Contacté</Badge>
            <p>Le lead a été contacté ou envoyé vers une campagne LGM. La date de contact est enregistrée automatiquement.</p>
          </div>
          <div className="flex items-start gap-3 p-3 border border-red-200 bg-red-50">
            <Badge color="red">Ne pas contacter</Badge>
            <p>Le lead a été écarté et ne doit pas être recontacté.</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Changer le statut d&apos;une offre</p>
          <Step number={1}>
            Dans le tableau, repérez la colonne <strong>Statut</strong> sur la ligne de l&apos;offre concernée.
          </Step>
          <Step number={2}>
            Cliquez sur le statut actuel pour ouvrir le menu déroulant et sélectionnez le nouveau statut.
          </Step>
          <Step number={3}>
            Si vous choisissez <Badge color="green">Contacté</Badge> et que des audiences LGM sont configurées, une liste d&apos;audiences vous sera proposée avant confirmation.
          </Step>
        </div>
      </div>
    ),
  },
  {
    id: "phone",
    icon: <Phone size={20} />,
    title: "Rechercher le numéro de téléphone",
    content: (
      <div className="space-y-4">
        <p>
          L&apos;outil permet de signaler des leads pour lesquels vous souhaitez retrouver un numéro de téléphone.
        </p>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Marquer un lead pour enrichissement téléphonique</p>
          <Step number={1}>
            Localisez la colonne <strong>Téléphone</strong> sur la ligne du lead concerné.
          </Step>
          <Step number={2}>
            Cochez la case correspondante pour indiquer que ce lead nécessite une recherche de numéro de téléphone.
          </Step>
          <Step number={3}>
            La case cochée signale le lead à votre équipe ou à votre processus d&apos;enrichissement. Le numéro peut ensuite être renseigné directement dans le champ dédié.
          </Step>
        </div>

        <p className="text-gray-500 italic">
          Note : la recherche effective du numéro dépend de vos outils d&apos;enrichissement externes. L&apos;outil se charge de signaler et de stocker l&apos;information.
        </p>
      </div>
    ),
  },
  {
    id: "export",
    icon: <Download size={20} />,
    title: "Exporter les données en CSV",
    content: (
      <div className="space-y-4">
        <p>
          Vous pouvez exporter tout ou partie des offres du tableau au format CSV, pour les exploiter dans Excel, Google Sheets ou tout autre outil.
        </p>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Lancer l&apos;export</p>
          <Step number={1}>
            Appliquez les filtres et la recherche souhaités pour sélectionner les offres à exporter (l&apos;export porte sur les données filtrées).
          </Step>
          <Step number={2}>
            Cliquez sur le bouton <strong>Exporter CSV</strong> en haut à droite du tableau.
          </Step>
          <Step number={3}>
            Le fichier est téléchargé automatiquement dans votre dossier de téléchargements.
          </Step>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sonate-ink">Contenu de l&apos;export</p>
          <p>Le fichier CSV inclut toutes les colonnes actuellement <strong>visibles</strong> dans le tableau, y compris les champs personnalisés. Pour inclure ou exclure des colonnes, ajustez leur visibilité avant d&apos;exporter.</p>
        </div>
      </div>
    ),
  },
];

function GeneralGuide() {
  return (
    <div className="mb-10">
      <div className="bg-sonate-green text-sonate-ivory px-6 py-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-sonate-orange" />
          <h2 className="text-base font-semibold">Comment ça fonctionne ?</h2>
        </div>
        <p className="text-sm text-gray-300">
          Tout ce que vous avez à faire au quotidien tient en 3 actions simples.
        </p>
      </div>

      <div className="space-y-3">
        {/* Step 0 - daily context */}
        <div className="flex gap-4 p-5 border border-gray-200 bg-sonate-ivory-light">
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-sonate-ink font-bold text-sm flex items-center justify-center">
            1
          </div>
          <div>
            <p className="font-semibold text-sonate-ink mb-1">Chaque jour, de nouvelles offres apparaissent</p>
            <p className="text-sm text-gray-600">
              Le fichier se met à jour automatiquement avec de nouvelles offres d&apos;emploi et le contact associé à chaque offre. Consultez le tableau chaque matin pour voir les nouvelles lignes.
            </p>
          </div>
        </div>

        {/* Step 1 - contacter */}
        <div className="flex gap-4 p-5 border border-green-200 bg-green-50">
          <div className="flex-shrink-0 w-8 h-8 bg-sonate-green-mid text-sonate-ivory font-bold text-sm flex items-center justify-center">
            2
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="font-semibold text-sonate-ink">Cocher &quot;Contacter&quot; pour prospecter automatiquement</p>
            </div>
            <p className="text-sm text-gray-700">
              Si le contact vous semble pertinent, cochez <strong>Contacter</strong> (1ère colonne). Le contact est alors <strong>automatiquement envoyé dans une campagne de prospection</strong>. Vous n&apos;avez rien d&apos;autre à faire. La date d&apos;envoi s&apos;affiche automatiquement dans la dernière colonne du tableau.
            </p>
          </div>
        </div>

        {/* Step 2 - ne pas contacter */}
        <div className="flex gap-4 p-5 border border-red-200 bg-red-50">
          <div className="flex-shrink-0 w-8 h-8 bg-red-400 text-sonate-ivory font-bold text-sm flex items-center justify-center">
            3
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={16} className="text-red-500" />
              <p className="font-semibold text-sonate-ink">Cocher &quot;Ne pas contacter&quot; pour écarter le contact</p>
            </div>
            <p className="text-sm text-gray-700">
              Si le contact n&apos;est pas qualifié, cochez simplement <strong>Ne pas contacter</strong>. Il ne sera pas inclus dans la campagne et sera mis de côté.
            </p>
          </div>
        </div>

        {/* Step 3 - chercher tel */}
        <div className="flex gap-4 p-5 border border-sonate-cream-border bg-sonate-ivory-light">
          <div className="flex-shrink-0 w-8 h-8 bg-sonate-green text-sonate-ivory font-bold text-sm flex items-center justify-center">
            +
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PhoneCall size={16} className="text-sonate-green" />
              <p className="font-semibold text-sonate-ink">En option : cocher &quot;Chercher tél&quot; pour prospecter par téléphone</p>
            </div>
            <p className="text-sm text-gray-700">
              Si vous souhaitez également appeler le contact (en complément de la campagne), cochez <strong>Chercher tél</strong>. Le numéro de téléphone s&apos;affichera automatiquement au bout de quelques secondes. C&apos;est ensuite à vous d&apos;appeler le prospect.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 text-xs text-gray-500">
        Les explications détaillées sur les filtres, colonnes et autres fonctionnalités sont disponibles dans les sections ci-dessous.
      </div>
    </div>
  );
}

export default function GuidePage() {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-sonate-green">Guide d&apos;utilisation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Retrouvez ici les explications pour utiliser les principales fonctionnalités de l&apos;outil.
        </p>
      </div>

      <GeneralGuide />

      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Fonctionnalités avancées</p>
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <AccordionItem
            key={section.id}
            section={section}
            isOpen={openId === section.id}
            onToggle={() => toggle(section.id)}
          />
        ))}
      </div>
    </div>
  );
}
