package com.pingo.backend.translation.service;

import com.pingo.backend.translation.dto.TranslationRequest;
import com.pingo.backend.translation.dto.TranslationResponse;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ConsultationTranslationService {

    /** 화면이 고를 수 있는 표시 언어. 그 밖의 값은 받지 않는다. */
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("ko", "en", "ja", "zh");

    private final Translator translator;

    public TranslationResponse translate(TranslationRequest request) {
        String target = baseLanguageOf(request.targetLanguage());

        /*
         * 지원하지 않는 언어는 옮기지 않고 원문을 돌려준다.
         *
         * 오류로 돌려주면 화면이 자막 자체를 띄우지 못한다. 옮기지 못한 원문이라도 보이는
         * 편이 아무것도 안 보이는 것보다 낫다.
         */
        if (!SUPPORTED_LANGUAGES.contains(target)) {
            return TranslationResponse.untouched(request.text(), target);
        }

        String translated = translator.translate(request.text(), target);
        return translated == null
                ? TranslationResponse.untouched(request.text(), target)
                : TranslationResponse.of(translated, target);
    }

    /** `ko-KR` 처럼 지역이 붙어 와도 언어만 본다. 브라우저가 그 형태로 주는 일이 잦다. */
    private String baseLanguageOf(String language) {
        String trimmed = language.trim().toLowerCase(Locale.ROOT);
        int separator = trimmed.indexOf('-');
        return separator < 0 ? trimmed : trimmed.substring(0, separator);
    }
}
