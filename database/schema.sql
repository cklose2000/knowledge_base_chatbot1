-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table - stores original uploaded files
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_date TIMESTAMP WITH TIME ZONE,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    source_integration VARCHAR(100), -- google_drive, onedrive, dropbox, etc.
    source_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks table - hierarchical chunking system
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    chunk_level INTEGER NOT NULL, -- 1=summary, 2=section, 3=detail
    chunk_order INTEGER NOT NULL,
    chunk_type VARCHAR(50) NOT NULL, -- summary, experience, education, skills, project, detail
    title TEXT,
    content TEXT NOT NULL,
    token_count INTEGER,
    
    -- Metadata for enhanced retrieval
    section_type VARCHAR(100), -- experience, education, skills, projects, summary
    company_name VARCHAR(255),
    job_title VARCHAR(255),
    institution_name VARCHAR(255),
    degree VARCHAR(255),
    technologies TEXT[], -- array of technologies mentioned
    skills TEXT[], -- array of skills mentioned
    date_range VARCHAR(100), -- "2020-2023", "Jan 2020 - Present"
    location VARCHAR(255),
    
    -- Vector embedding
    embedding vector(1536),
    
    -- Search optimization
    search_vector tsvector,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidate profiles table - extracted structured data
CREATE TABLE candidate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Basic info
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    
    -- Professional summary
    professional_summary TEXT,
    years_experience INTEGER,
    current_title VARCHAR(255),
    current_company VARCHAR(255),
    
    -- Skills and technologies
    technical_skills TEXT[],
    soft_skills TEXT[],
    certifications TEXT[],
    languages TEXT[],
    
    -- Education summary
    highest_degree VARCHAR(255),
    education_institutions TEXT[],
    
    -- Metadata
    profile_completeness_score DECIMAL(3,2), -- 0.00 to 1.00
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work experience table
CREATE TABLE work_experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id),
    
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    description TEXT,
    achievements TEXT[],
    technologies_used TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Education table
CREATE TABLE education (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id),
    
    institution_name VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    start_date DATE,
    end_date DATE,
    gpa DECIMAL(3,2),
    honors TEXT[],
    relevant_coursework TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search queries table - for analytics and improvement
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    user_id UUID, -- if we have user management
    session_id VARCHAR(255),
    results_count INTEGER,
    clicked_results UUID[], -- array of chunk IDs that were clicked
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_type ON documents(file_type);
CREATE INDEX idx_documents_upload_date ON documents(upload_date);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_parent_id ON document_chunks(parent_chunk_id);
CREATE INDEX idx_chunks_level ON document_chunks(chunk_level);
CREATE INDEX idx_chunks_type ON document_chunks(chunk_type);
CREATE INDEX idx_chunks_section_type ON document_chunks(section_type);
CREATE INDEX idx_chunks_company ON document_chunks(company_name);
CREATE INDEX idx_chunks_title ON document_chunks(job_title);

-- Vector similarity search index
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Full-text search index
CREATE INDEX idx_chunks_search_vector ON document_chunks USING gin(search_vector);

-- Composite indexes for common queries
CREATE INDEX idx_chunks_doc_level_order ON document_chunks(document_id, chunk_level, chunk_order);
CREATE INDEX idx_chunks_type_company ON document_chunks(chunk_type, company_name) WHERE company_name IS NOT NULL;

-- Update search vector trigger
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.title, '') || ' ' || 
        COALESCE(NEW.content, '') || ' ' ||
        COALESCE(NEW.company_name, '') || ' ' ||
        COALESCE(NEW.job_title, '') || ' ' ||
        COALESCE(array_to_string(NEW.technologies, ' '), '') || ' ' ||
        COALESCE(array_to_string(NEW.skills, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chunks_search_vector
    BEFORE INSERT OR UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Function to get hierarchical chunks for a document
CREATE OR REPLACE FUNCTION get_document_hierarchy(doc_id UUID)
RETURNS TABLE (
    chunk_id UUID,
    parent_id UUID,
    level INTEGER,
    chunk_order INTEGER,
    chunk_type VARCHAR,
    title TEXT,
    content TEXT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE chunk_hierarchy AS (
        -- Base case: top-level chunks
        SELECT 
            dc.id,
            dc.parent_chunk_id,
            dc.chunk_level,
            dc.chunk_order,
            dc.chunk_type,
            dc.title,
            dc.content,
            jsonb_build_object(
                'company_name', dc.company_name,
                'job_title', dc.job_title,
                'technologies', dc.technologies,
                'skills', dc.skills,
                'date_range', dc.date_range,
                'location', dc.location
            ) as metadata
        FROM document_chunks dc
        WHERE dc.document_id = doc_id AND dc.parent_chunk_id IS NULL
        
        UNION ALL
        
        -- Recursive case: child chunks
        SELECT 
            dc.id,
            dc.parent_chunk_id,
            dc.chunk_level,
            dc.chunk_order,
            dc.chunk_type,
            dc.title,
            dc.content,
            jsonb_build_object(
                'company_name', dc.company_name,
                'job_title', dc.job_title,
                'technologies', dc.technologies,
                'skills', dc.skills,
                'date_range', dc.date_range,
                'location', dc.location
            ) as metadata
        FROM document_chunks dc
        INNER JOIN chunk_hierarchy ch ON dc.parent_chunk_id = ch.chunk_id
    )
    SELECT * FROM chunk_hierarchy
    ORDER BY level, chunk_order;
END;
$$ LANGUAGE plpgsql;

-- Function for semantic search with metadata filtering
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    filter_chunk_types VARCHAR[] DEFAULT NULL,
    filter_companies VARCHAR[] DEFAULT NULL,
    filter_technologies VARCHAR[] DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    similarity FLOAT,
    chunk_type VARCHAR,
    title TEXT,
    content TEXT,
    company_name VARCHAR,
    job_title VARCHAR,
    technologies TEXT[],
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        (1 - (dc.embedding <=> query_embedding)) as similarity,
        dc.chunk_type,
        dc.title,
        dc.content,
        dc.company_name,
        dc.job_title,
        dc.technologies,
        jsonb_build_object(
            'section_type', dc.section_type,
            'institution_name', dc.institution_name,
            'degree', dc.degree,
            'skills', dc.skills,
            'date_range', dc.date_range,
            'location', dc.location,
            'chunk_level', dc.chunk_level,
            'token_count', dc.token_count
        ) as metadata
    FROM document_chunks dc
    WHERE 
        (1 - (dc.embedding <=> query_embedding)) >= similarity_threshold
        AND (filter_chunk_types IS NULL OR dc.chunk_type = ANY(filter_chunk_types))
        AND (filter_companies IS NULL OR dc.company_name = ANY(filter_companies))
        AND (filter_technologies IS NULL OR dc.technologies && filter_technologies)
    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql; 