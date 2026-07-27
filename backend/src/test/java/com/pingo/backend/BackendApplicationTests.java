package com.pingo.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 전체 스프링 컨텍스트 로드 스모크 테스트(Flyway 마이그레이션·JPA validate·빈 배선 포함).
 *
 * <p>Flyway V1 은 MySQL 전용 문법(JSON, AUTO_INCREMENT)을 사용하므로 H2 로는 검증할 수 없다.
 * 따라서 실제 DB 가 주입된 환경(CI: {@code SPRING_DATASOURCE_URL})에서만 실행하고,
 * 해당 환경변수가 없는 로컬 {@code ./gradlew test} 에서는 건너뛴다.
 * 통합 검증은 Jenkins 가 실 MySQL 로 배포 전에 수행한다. (S15P11A206-271)
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "SPRING_DATASOURCE_URL", matches = ".+",
		disabledReason = "실 DB 가 주입된 CI 에서만 실행 (로컬은 H2 Flyway 미지원으로 skip)")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
