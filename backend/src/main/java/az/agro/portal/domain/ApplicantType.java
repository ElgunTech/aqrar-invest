package az.agro.portal.domain;

public enum ApplicantType {
    /** Citizen of Azerbaijan (incl. sole proprietors, local residents): identified by FİN. */
    INDIVIDUAL("Fiziki şəxs"),
    /** Registered company: identified by VÖEN. */
    COMPANY("Hüquqi şəxs"),
    /** Foreign citizen or foreign investor: identified by passport number and citizenship. */
    FOREIGN("Xarici vətəndaş");

    private final String label;

    ApplicantType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
