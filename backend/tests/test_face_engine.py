"""Tests for the face recognition engine."""

import numpy as np
import pytest

from app.services.face_engine import FaceEngine, DetectedFace, MatchResult


class TestFaceEngine:
    """Unit tests for the FaceEngine class."""

    def setup_method(self):
        """Fresh engine instance for each test (bypassing singleton for tests)."""
        self.engine = FaceEngine.__new__(FaceEngine)
        self.engine._detector = None
        self.engine._recogniser = None
        self.engine._anti_spoof = None
        self.engine._embeddings_cache = []
        self.engine._initialised = True

    def test_mock_detect(self):
        """Test mock detection returns a face."""
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        faces = self.engine.detect_faces(image)
        assert len(faces) == 1
        assert faces[0].confidence > 0.5
        assert faces[0].quality == "good"

    def test_mock_embedding(self):
        """Test mock embedding returns correct shape."""
        emb = self.engine._mock_embedding()
        assert emb.shape == (512,)
        # Should be L2-normalised
        norm = np.linalg.norm(emb)
        assert abs(norm - 1.0) < 0.01

    def test_match_embedding_empty_cache(self):
        """Test matching with no cached embeddings returns no match."""
        query = np.random.randn(512).astype(np.float32)
        query = query / np.linalg.norm(query)
        result = self.engine.match_embedding(query)
        assert result.matched is False
        assert result.student_db_id is None

    def test_match_embedding_exact(self):
        """Test matching with identical embedding returns match."""
        emb = np.random.randn(512).astype(np.float32)
        emb = emb / np.linalg.norm(emb)

        self.engine.load_embeddings_cache([
            {
                "db_id": 1,
                "student_id": "STU-001",
                "name": "Test Student",
                "embedding_bytes": emb.tobytes(),
            }
        ])

        result = self.engine.match_embedding(emb)
        assert result.matched is True
        assert result.student_db_id == 1
        assert result.student_name == "Test Student"
        assert result.similarity > 0.99

    def test_match_embedding_different(self):
        """Test matching with very different embedding returns no match."""
        emb1 = np.zeros(512, dtype=np.float32)
        emb1[0] = 1.0  # Unit vector along first axis

        emb2 = np.zeros(512, dtype=np.float32)
        emb2[1] = 1.0  # Unit vector along second axis (orthogonal)

        self.engine.load_embeddings_cache([
            {
                "db_id": 1,
                "student_id": "STU-001",
                "name": "Student 1",
                "embedding_bytes": emb1.tobytes(),
            }
        ])

        result = self.engine.match_embedding(emb2)
        assert result.matched is False

    def test_load_embeddings_cache(self):
        """Test loading multiple embeddings into cache."""
        students = []
        for i in range(5):
            emb = np.random.randn(512).astype(np.float32)
            emb = emb / np.linalg.norm(emb)
            students.append({
                "db_id": i + 1,
                "student_id": f"STU-{i:03d}",
                "name": f"Student {i}",
                "embedding_bytes": emb.tobytes(),
            })

        self.engine.load_embeddings_cache(students)
        assert len(self.engine._embeddings_cache) == 5

    def test_quality_assessment_good(self):
        """Test quality assessment for adequate face size."""
        quality = self.engine._assess_quality(150, 150, (480, 640, 3))
        assert quality == "good"

    def test_quality_assessment_low(self):
        """Test quality assessment for small face."""
        quality = self.engine._assess_quality(60, 60, (480, 640, 3))
        assert quality == "low"

    def test_quality_assessment_rejected(self):
        """Test quality assessment for too-small face."""
        quality = self.engine._assess_quality(30, 30, (480, 640, 3))
        assert quality == "rejected"

    def test_process_frame_demo_mode(self):
        """Test full pipeline in demo mode."""
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        faces = self.engine.process_frame(image)
        assert len(faces) >= 1
        for face in faces:
            assert face.embedding is not None
            assert face.embedding.shape == (512,)
            assert face.is_live is True
