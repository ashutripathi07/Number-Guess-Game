package com.lesson.MiniProject;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public class GuessServer {

    // Cloud platforms tell us which port to use through the PORT environment variable
    private static final int PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
    // Set this to your Vercel URL in production, e.g. https://number-guess.vercel.app
    private static final String ALLOWED_ORIGIN = System.getenv().getOrDefault("ALLOWED_ORIGIN", "*");

    private static final Pattern ID_PATTERN = Pattern.compile("[A-Za-z0-9-]{8,64}");
    private static final int MAX_GAMES = 5000; // protects memory on a free server

    // One game per player, found by the id the browser sends
    private static final Map<String, Game> games = new ConcurrentHashMap<>();

    private static class Game {
        int secret = newSecret();
        int attempts = 0;
    }

    private static int newSecret() {
        return (int) (Math.random() * 100);
    }

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/", GuessServer::handleApi);
        server.createContext("/", ex -> send(ex, 200, "text/plain", "Number Guess API is running"));
        server.start();
        System.out.println("API running on port " + PORT + ", allowed origin: " + ALLOWED_ORIGIN);
    }

    // ---------- Game logic ----------

    private static Game getGame(String id) {
        if (games.size() >= MAX_GAMES && !games.containsKey(id)) {
            games.clear();
        }
        return games.computeIfAbsent(id, k -> new Game());
    }

    private static String newGame(String id) {
        games.remove(id);
        getGame(id);
        return "{\"ok\":true}";
    }

    private static String guess(String id, int n) {
        Game g = getGame(id);
        synchronized (g) {
            g.attempts++;
            String result = n == g.secret ? "win" : n > g.secret ? "high" : "low";
            String json = "{\"result\":\"" + result + "\",\"attempts\":" + g.attempts + "}";
            if (n == g.secret) {
                g.secret = newSecret();
                g.attempts = 0;
            }
            return json;
        }
    }

    private static String giveUp(String id) {
        Game g = getGame(id);
        synchronized (g) {
            String json = "{\"secret\":" + g.secret + "}";
            g.secret = newSecret();
            g.attempts = 0;
            return json;
        }
    }

    // ---------- HTTP ----------

    private static void handleApi(HttpExchange ex) throws IOException {
        addCors(ex);

        String method = ex.getRequestMethod();
        if ("OPTIONS".equals(method)) {          // browser "preflight" check
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        if (!"POST".equals(method)) {
            send(ex, 405, "text/plain", "Use POST");
            return;
        }

        Map<String, String> q = parseQuery(ex.getRequestURI().getRawQuery());
        String id = q.get("id");
        if (id == null || !ID_PATTERN.matcher(id).matches()) {
            send(ex, 400, "application/json", "{\"error\":\"Missing or invalid id\"}");
            return;
        }

        switch (ex.getRequestURI().getPath()) {
            case "/api/new" -> send(ex, 200, "application/json", newGame(id));
            case "/api/giveup" -> send(ex, 200, "application/json", giveUp(id));
            case "/api/guess" -> {
                Integer n = parseGuess(q.get("n"));
                if (n == null) {
                    send(ex, 400, "application/json", "{\"error\":\"Guess must be 0 to 99\"}");
                } else {
                    send(ex, 200, "application/json", guess(id, n));
                }
            }
            default -> send(ex, 404, "text/plain", "Not found");
        }
    }

    private static void addCors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.getResponseHeaders().set("Access-Control-Max-Age", "86400");
    }

    // ---------- Helpers ----------

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> map = new HashMap<>();
        if (raw == null) return map;
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0) map.put(pair.substring(0, eq), pair.substring(eq + 1));
        }
        return map;
    }

    private static Integer parseGuess(String s) {
        if (s == null) return null;
        try {
            int n = Integer.parseInt(s);
            return (n >= 0 && n <= 99) ? n : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void send(HttpExchange ex, int code, String type, String text) throws IOException {
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type);
        ex.sendResponseHeaders(code, body.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(body);
        }
    }
}