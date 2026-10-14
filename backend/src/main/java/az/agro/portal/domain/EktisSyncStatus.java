package az.agro.portal.domain;

public enum EktisSyncStatus {
    NOT_SENT("Göndərilməyib"),
    SENT("EKTİS-ə göndərilib"),
    VERIFIED("EKTİS-də təsdiqlənib"),
    FAILED("Göndərmə xətası");

    private final String label;

    EktisSyncStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
