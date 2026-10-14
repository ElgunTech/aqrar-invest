package az.agro.portal.domain;

public enum CompetitionStatus {
    DRAFT("Qaralama"),
    PENDING_APPROVAL("Təsdiq gözləyir"),
    PUBLISHED("Elan edilib"),
    CLOSED("Bağlanıb"),
    CANCELLED("Ləğv edilib");

    private final String label;

    CompetitionStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
