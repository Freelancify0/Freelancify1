import Gig from "../models/gig.model.js";
import createError from "../utils/createError.js";

// Define the category mapping globally for reuse
const categoryMapping = {
  "design": ["design", "graphic", "designer", "logo", "illustration", "ui", "ux", "art"],
  "web": ["web", "website", "development", "frontend", "backend", "dev", "html", "css", "javascript", "react", "node"],
  "mobile-dev": ["mobile", "app", "android", "ios", "development", "dev", "flutter", "react native", "swift"],
  "animation": ["animation", "animate", "motion", "3d", "character", "rigging"],
  "video": ["video", "editing", "production", "filming", "montage", "after effects", "premiere"],
  "writing": ["writing", "translation", "content", "copywriting", "writer", "blog", "article", "proofreading"],
  "music": ["music", "audio", "sound", "recording", "production", "mixing", "mastering", "vocals"],
  "digital-marketing": ["digital", "marketing", "ads", "advertising", "promotion", "social media", "email", "campaign"],
  "seo": ["seo", "search engine", "optimization", "traffic", "ranking", "keywords", "backlinks"]
};

// Get all predefined category IDs for reference
const predefinedCategories = Object.keys(categoryMapping);

export const createGig = async (req, res, next) => {
  if (!req.isSeller)
    return next(createError(403, "Only sellers can create a gig!"));

  const newGig = new Gig({
    userId: req.userId,
    ...req.body,
  });

  try {
    const savedGig = await newGig.save();
    res.status(201).json(savedGig);
  } catch (err) {
    next(err);
  }
};

export const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (gig.userId !== req.userId)
      return next(createError(403, "You can delete only your gig!"));

    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).send("Gig has been deleted!");
  } catch (err) {
    next(err);
  }
};

export const getGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) next(createError(404, "Gig not found!"));
    res.status(200).send(gig);
  } catch (err) {
    next(err);
  }
};

export const getGigs = async (req, res, next) => {
  const q = req.query;
  
  // Initialize base filters
  const filters = {
    ...(q.userId && { userId: q.userId }),
    ...((q.min || q.max) && {
      price: {
        ...(q.min && { $gt: parseInt(q.min) }),
        ...(q.max && { $lt: parseInt(q.max) }),
      },
    }),
  };
  
  // Special handling for "other" category
  if (q.cat === "other") {
    filters.cat = { $nin: predefinedCategories };
  } 
  // Normal category filter
  else if (q.cat) {
    filters.cat = q.cat;
  }
  
  // Enhanced search functionality
  if (q.search) {
    // Prepare search terms - split by spaces for multi-word searches
    const searchTerms = q.search.trim().split(/\s+/).filter(term => term.length > 0);
    
    if (searchTerms.length > 0) {
      const searchConditions = [];
      const potentialCategories = new Set();
      let includeOtherCategories = false;
      
      // First, identify any potential category matches
      searchTerms.forEach(term => {
        const lowerTerm = term.toLowerCase();
        let foundMatchForTerm = false;
        
        // Check if this term matches any category keywords
        Object.entries(categoryMapping).forEach(([category, keywords]) => {
          // Direct category match
          if (category.toLowerCase().includes(lowerTerm)) {
            potentialCategories.add(category);
            foundMatchForTerm = true;
          }
          
          // Keyword match
          keywords.forEach(keyword => {
            if (keyword.toLowerCase().includes(lowerTerm) || lowerTerm.includes(keyword.toLowerCase())) {
              potentialCategories.add(category);
              foundMatchForTerm = true;
            }
          });
        });
        
        // If no category matches found for this term, include "other" categories
        if (!foundMatchForTerm) {
          includeOtherCategories = true;
        }
      });
      
      // Handle category filters in search
      if (potentialCategories.size > 0 || includeOtherCategories) {
        const categoryCondition = { $or: [] };
        
        // Add all matched categories
        if (potentialCategories.size > 0) {
          categoryCondition.$or.push(...Array.from(potentialCategories).map(category => ({ cat: category })));
        }
        
        // If we should include other categories
        if (includeOtherCategories) {
          // Include gigs where cat is not in any of the predefined categories
          categoryCondition.$or.push({
            cat: { $nin: predefinedCategories }
          });
        }
        
        searchConditions.push(categoryCondition);
      }
      
      // Add general search conditions (title, desc, etc.)
      searchTerms.forEach(term => {
        searchConditions.push({
          $or: [
            { title: { $regex: term, $options: "i" } },
            { desc: { $regex: term, $options: "i" } },
            { shortTitle: { $regex: term, $options: "i" } },
            { shortDesc: { $regex: term, $options: "i" } },
            // Search in features array
            { features: { $elemMatch: { $regex: term, $options: "i" } } }
          ]
        });
      });

      // Add the search conditions to the filters
      filters.$and = searchConditions;
    }
  }
  
  // Log the search filters for debugging
  console.log("Search filters:", JSON.stringify(filters, null, 2));

  try {
    // Return relevance-sorted results
    let sortOption = { [q.sort || "sales"]: -1 };
    
    const gigs = await Gig.find(filters).sort(sortOption);
    
    // Log results count for debugging
    console.log(`Query returned ${gigs.length} results`);
    
    res.status(200).send(gigs);
  } catch (err) {
    console.error("Search error:", err);
    next(err);
  }
};