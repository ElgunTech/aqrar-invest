package az.agro.portal.dto;

import az.agro.portal.domain.*;

/** Converts enums to {code, label} pairs so the UI never hard-codes Azerbaijani texts for statuses. */
public final class Labels {

    private Labels() {
    }

    public static PlotDtos.Label of(Enum<?> e) {
        if (e == null) return null;
        String label = switch (e) {
            case ActivityType a -> a.getLabel();
            case MineClearanceStatus m -> m.getLabel();
            case PlotStatus p -> p.getLabel();
            case CompetitionStatus c -> c.getLabel();
            case ApplicationStatus s -> s.getLabel();
            case ApplicantType t -> t.getLabel();
            case DocumentType d -> d.getLabel();
            case EktisSyncStatus k -> k.getLabel();
            case IntegrationEventStatus i -> i.getLabel();
            case Role r -> r.getLabel();
            default -> e.name();
        };
        return new PlotDtos.Label(e.name(), label);
    }

    /** "AB1234C" → "AB***4C". Personal identifiers are masked in all list views. */
    public static String maskTaxId(String taxId) {
        if (taxId == null || taxId.length() < 5) return "***";
        return taxId.substring(0, 2) + "*".repeat(taxId.length() - 4) + taxId.substring(taxId.length() - 2);
    }
}
