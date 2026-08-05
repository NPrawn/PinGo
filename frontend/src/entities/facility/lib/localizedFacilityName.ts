import { localizedNameOf, type ApiLanguage } from '@/shared/i18n';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import type { Facility } from '../model/types';

export function facilityMatchesLabel(
  facility: Pick<Facility, 'nameKo' | 'nameEn'>,
  label: string | null | undefined,
): boolean {
  const normalized = label?.trim().toLowerCase();
  if (!normalized) return false;
  if (facility.nameKo.trim().toLowerCase() === normalized) return true;
  if (facility.nameEn?.trim().toLowerCase() === normalized) return true;

  const exitNumberOf = (value: string) =>
    /^(?:exit)?(\d+)(?:번)?(?:출구|출입구)?$/.exec(value.replace(/\s+/g, ''))?.[1];
  const labelExitNumber = exitNumberOf(normalized);
  const facilityExitNumber = exitNumberOf(facility.nameKo.trim().toLowerCase());
  return labelExitNumber != null && labelExitNumber === facilityExitNumber;
}

export function facilityAtNodeMatchingLabel(
  facilities: readonly Facility[] | null | undefined,
  nodeId: number | null | undefined,
  label: string | null | undefined,
): Facility | undefined {
  if (nodeId == null) return undefined;
  return facilities?.find(
    (facility) => facility.linkedNodeId === nodeId && facilityMatchesLabel(facility, label),
  );
}

/** Returns the facility name matching the active UI language. */
export function localizedFacilityNameOf(
  facility: Pick<Facility, 'nameKo' | 'nameEn'>,
  language: ApiLanguage,
): string {
  const localized = localizedNameOf(language, facility.nameKo, facility.nameEn) ?? facility.nameKo;

  // Some old records have no nameEn. Keep the existing known-label fallback for those rows.
  return language === 'en' && !facility.nameEn?.trim()
    ? localizeUserLabel(localized, language)
    : localized;
}

/** Resolves a route node to its bilingual facility record before using the node label. */
export function localizedFacilityNameAtNode(
  facilities: readonly Facility[] | null | undefined,
  nodeId: number | null | undefined,
  language: ApiLanguage,
  fallback: string,
): string {
  const facility =
    nodeId == null ? undefined : facilities?.find((item) => item.linkedNodeId === nodeId);

  return facility
    ? localizedFacilityNameOf(facility, language)
    : localizeUserLabel(fallback, language);
}
