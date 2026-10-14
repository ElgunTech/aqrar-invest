package az.agro.portal.domain;

public enum MineClearanceStatus {
    CLEARED("Minadan təmizlənib"),
    IN_PROGRESS("Təmizlənmə davam edir"),
    PLANNED("Təmizlənmə planlaşdırılıb");

    private final String label;

    MineClearanceStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
