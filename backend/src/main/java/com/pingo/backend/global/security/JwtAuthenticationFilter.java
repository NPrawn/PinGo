package com.pingo.backend.global.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;
    public JwtAuthenticationFilter(JwtProvider jwtProvider){
        this.jwtProvider = jwtProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = resolveToken(request);

        if(StringUtils.hasText(token)){
            try{

                JwtPrincipal principal = jwtProvider.parseToken(token);

                var authorities = List.of(new SimpleGrantedAuthority("ROLE_"+principal.accountType().name()));
                var authentication = new UsernamePasswordAuthenticationToken(principal.accountId(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (JwtException | IllegalArgumentException e){
                // 토큰이 유효하지 않거나 만료됨 → 인증 미설정 상태로 넘기고,
                // 이후 인가 단계(anyRequest().authenticated())에서 401 처리되게 둔다.
                SecurityContextHolder.clearContext();;
            }
        }
        filterChain.doFilter(request,response);
    }

    private String resolveToken(HttpServletRequest request){
        String bearer = request.getHeader(HEADER);
        if(StringUtils.hasText(bearer) && bearer.startsWith(PREFIX)){
            return bearer.substring(PREFIX.length());
        }
        return null;
    }
}
