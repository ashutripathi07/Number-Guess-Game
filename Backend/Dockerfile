FROM eclipse-temurin:21-jdk

WORKDIR /app
COPY src ./src

  # Compile the server into the "out" folder
RUN mkdir out && javac -d out src/com/lesson/MiniProject/GuessServer.java

  # The platform sets PORT; the code reads it
CMD ["java", "-cp", "out", "com.lesson.MiniProject.GuessServer"]
