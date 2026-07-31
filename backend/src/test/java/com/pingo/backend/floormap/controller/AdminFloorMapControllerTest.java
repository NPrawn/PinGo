package com.pingo.backend.floormap.controller;

import com.pingo.backend.floormap.dto.request.FloorMapUploadRequest;
import com.pingo.backend.floormap.dto.response.FloorMapIdResponse;
import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.service.FloorMapService;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminFloorMapControllerTest {

    @Mock
    private FloorMapService floorMapService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminFloorMapController controller = new AdminFloorMapController(floorMapService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void uploadMapReturnsCreatedResponse() throws Exception {
        when(floorMapService.uploadMap(eq(2L), any(FloorMapUploadRequest.class), any(MultipartFile.class)))
                .thenReturn(new FloorMapIdResponse(11L));
        MockMultipartFile mapFile = new MockMultipartFile("mapFile", "b1.png", "image/png", "data".getBytes());

        mockMvc.perform(multipart("/api/admin/floors/2/maps")
                        .file(mapFile)
                        .param("mapType", "image")
                        .param("width", "1200")
                        .param("height", "800"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.mapId").value(11L));
    }

    @Test
    void uploadMapReturnsBadRequestWhenMapTypeMissing() throws Exception {
        MockMultipartFile mapFile = new MockMultipartFile("mapFile", "b1.png", "image/png", "data".getBytes());

        mockMvc.perform(multipart("/api/admin/floors/2/maps")
                        .file(mapFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getMapsReturnsFloorMaps() throws Exception {
        when(floorMapService.getMaps(2L)).thenReturn(List.of(
                new FloorMapResponse(11L, 2L, "B2", "image", "/uploads/maps/new.png", 1200, 800, null, null, null, null, "v1")));

        mockMvc.perform(get("/api/admin/floors/2/maps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].mapId").value(11L))
                .andExpect(jsonPath("$.data[0].floorCode").value("B2"))
                .andExpect(jsonPath("$.data[0].mapUrl").value("/uploads/maps/new.png"));
    }
}
