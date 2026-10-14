package az.agro.portal.domain;

public enum ApplicantType {
    INDIVIDUAL("Fiziki şəxs / fərdi sahibkar"),
    COMPANY("Hüquqi şəxs (şirkət)");

    private final String label;

    ApplicantType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
