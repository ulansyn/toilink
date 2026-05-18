package kg.toilink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ToilinkApplication {

	public static void main(String[] args) {
		SpringApplication.run(ToilinkApplication.class, args);
	}

}
