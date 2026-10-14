package az.agro.portal.service;

import az.agro.portal.ai.CropRecommendation;
import az.agro.portal.ai.CropRecommendationService;
import az.agro.portal.ai.SoilClimate;
import az.agro.portal.domain.InvestmentApplication;
import az.agro.portal.domain.LandPlot;
import az.agro.portal.dto.ApplicationDtos.ScoreBreakdown;
import az.agro.portal.dto.ApplicationDtos.ScoreItem;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Transparent automatic pre-evaluation (0–100). It supports the evaluator; it never decides on its own.
 * Every point is explained, so the applicant and the commission see the same reasoning.
 */
@Component
public class ApplicationScorer {

    private final CropRecommendationService ai;

    public ApplicationScorer(CropRecommendationService ai) {
        this.ai = ai;
    }

    public ScoreBreakdown score(InvestmentApplication a) {
        LandPlot plot = a.getPlot();
        List<ScoreItem> items = new ArrayList<>();

        long min = plot.getMinInvestment();
        int inv = a.getPlannedInvestment() >= min ? 25 : a.getPlannedInvestment() >= min * 0.75 ? 15 : 5;
        items.add(new ScoreItem("İnvestisiya həcmi", inv, 25,
                "Planlaşdırılan " + a.getPlannedInvestment() + " AZN, minimum tələb " + min + " AZN"));

        int own = a.getOwnFundsPercent() >= 30 ? 10 : a.getOwnFundsPercent() >= 15 ? 7 : 3;
        items.add(new ScoreItem("Öz vəsaitinin payı", own, 10, a.getOwnFundsPercent() + "%"));

        int jobs = a.getJobsCreated() >= 20 ? 15 : a.getJobsCreated() >= 10 ? 11 : a.getJobsCreated() >= 5 ? 7 : 3;
        items.add(new ScoreItem("Yaradılacaq iş yerləri", jobs, 15, a.getJobsCreated() + " iş yeri"));

        int exp = a.getExperienceYears() >= 5 ? 10 : a.getExperienceYears() >= 2 ? 7 : 3;
        items.add(new ScoreItem("Aqrar sahədə təcrübə", exp, 10, a.getExperienceYears() + " il"));

        double share = a.getJobsCreated() == 0 ? 0 : (double) a.getReturneeJobs() / a.getJobsCreated();
        int ret = share >= 0.5 ? 10 : share >= 0.25 ? 6 : a.getReturneeJobs() > 0 ? 3 : 0;
        items.add(new ScoreItem("Böyük Qayıdış: qayıdan sakinlərin işlə təmini", ret, 10,
                a.getReturneeJobs() + " / " + a.getJobsCreated() + " iş yeri (" + Math.round(share * 100) + "%)"));

        boolean sameActivity = a.getActivityType() == plot.getActivityType();
        items.add(new ScoreItem("Fəaliyyətin sahənin təyinatına uyğunluğu", sameActivity ? 15 : 5, 15,
                sameActivity ? "Uyğundur" : "Sahənin təyinatı: " + plot.getActivityType().getLabel()));

        items.add(cropFit(a, plot));

        int total = items.stream().mapToInt(ScoreItem::points).sum();
        return new ScoreBreakdown(Math.min(100, total), items);
    }

    private ScoreItem cropFit(InvestmentApplication a, LandPlot plot) {
        String crop = a.getPlannedCrop();
        if (crop == null || crop.isBlank()) {
            return new ScoreItem("AI: bitkinin torpağa uyğunluğu", 8, 15, "Bitki göstərilməyib (neytral bal)");
        }
        CropRecommendation rec = ai.recommend(SoilClimate.of(plot));
        List<CropRecommendation.CropScore> top = rec.recommendations();
        for (int i = 0; i < top.size(); i++) {
            if (top.get(i).code().equalsIgnoreCase(crop)) {
                int pts = i == 0 ? 15 : 10;
                return new ScoreItem("AI: bitkinin torpağa uyğunluğu", pts, 15,
                        "AI tövsiyəsində " + (i + 1) + "-ci yerdədir (" + Math.round(top.get(i).probability() * 100) + "%)");
            }
        }
        String best = top.isEmpty() ? "-" : top.get(0).name();
        return new ScoreItem("AI: bitkinin torpağa uyğunluğu", 4, 15, "Torpaq üçün optimal deyil; AI tövsiyəsi: " + best);
    }
}
