package az.agro.portal.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * The React front end uses client-side routing (/xerite, /sahe/12, ...). Any such path that is not an API,
 * documentation or static file is answered with index.html so a page refresh or a shared link works.
 */
@Controller
public class SpaController {

    @GetMapping({
            "/{path:^(?!api|v3|swagger-ui|mock-ektis|mock-mygov|assets|world)[^.]*$}",
            "/{path:^(?!api|v3|swagger-ui|mock-ektis|mock-mygov|assets|world)[^.]*$}/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
