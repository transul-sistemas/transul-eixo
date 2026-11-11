import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowsExchange,
  IconBook,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendarCheck,
  IconCalendarWeek,
  IconCash,
  IconChartBar,
  IconChartLine,
  IconChecklist,
  IconCirclePlus,
  IconClipboardList,
  IconDatabase,
  IconFiles,
  IconGasStation,
  IconHeartHandshake,
  IconHistory,
  IconHome2,
  IconHourglass,
  IconKey,
  IconLayoutDashboard,
  IconLicense,
  IconListDetails,
  IconLock,
  IconPalette,
  IconParking,
  IconRoute,
  IconRoute2,
  IconScale,
  IconSend,
  IconSettings,
  IconSitemap,
  IconSpeakerphone,
  IconSunHigh,
  IconTicket,
  IconTruck,
  IconUser,
  IconUsers,
  IconUserShield,
  IconWallet,
} from "@tabler/icons-react";

export type Icone = typeof IconHome2;

// O catálogo guarda só o nome do ícone; este mapa o transforma em componente. Um nome que não
// está aqui quebra o teste de catálogo, não a tela.
const ICONES: Record<string, Icone> = {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowsExchange,
  IconBook,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendarCheck,
  IconCalendarWeek,
  IconCash,
  IconChartBar,
  IconChartLine,
  IconChecklist,
  IconCirclePlus,
  IconClipboardList,
  IconDatabase,
  IconFiles,
  IconGasStation,
  IconHeartHandshake,
  IconHistory,
  IconHome2,
  IconHourglass,
  IconKey,
  IconLayoutDashboard,
  IconLicense,
  IconListDetails,
  IconLock,
  IconPalette,
  IconParking,
  IconRoute,
  IconRoute2,
  IconScale,
  IconSend,
  IconSettings,
  IconSitemap,
  IconSpeakerphone,
  IconSunHigh,
  IconTicket,
  IconTruck,
  IconUser,
  IconUsers,
  IconUserShield,
  IconWallet,
};

export function iconeDe(nome: string): Icone {
  const icone = ICONES[nome];
  if (!icone) throw new Error(`Ícone ${nome} não está em components/navegacao/icones.tsx`);
  return icone;
}

/** O ícone do catálogo como elemento. Nome que não está no mapa dá erro claro. */
export function IconeDoCatalogo({ nome, className }: { nome: string; className?: string }) {
  const Icone = ICONES[nome];
  if (!Icone) throw new Error(`Ícone ${nome} não está em components/navegacao/icones.tsx`);
  return <Icone aria-hidden className={className} />;
}
