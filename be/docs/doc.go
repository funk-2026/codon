// Package docs provides the Swagger/OpenAPI specification for the Codon backend API.
// This file contains the main API info annotation — individual route annotations
// live in the handler files.
//
// @title                       Codon Backend API
// @version                     1.0
// @description                 Backend API for Codon — NEET UG / 9th / 10th exam-prep mobile learning platform.
// @description                 Supports student onboarding, OTP auth, Q Bank / Test Series / Practice, Video Classes, Razorpay subscriptions, KYC, and mental well-being content.
// @termsOfService              http://swagger.io/terms/
//
// @contact.name                Codon Engineering
// @contact.email               dev@codon.app
//
// @license.name                Proprietary
//
// @host                        localhost:8080
// @BasePath                    /api/v1
//
// @securityDefinitions.apikey  BearerAuth
// @in                          header
// @name                        Authorization
// @description                 Type "Bearer" followed by a space and the JWT token.
//
// @tag.name                    Auth
// @tag.description             OTP-based authentication and session management
//
// @tag.name                    Profile
// @tag.description             Authenticated user profile and progress
//
// @tag.name                    Courses
// @tag.description             Fixed 3-course catalogue
//
// @tag.name                    Subscription Plans
// @tag.description             Admin-managed subscription plans
//
// @tag.name                    Subscriptions & Payments
// @tag.description             Razorpay checkout, webhook, payment records
//
// @tag.name                    KYC
// @tag.description             Identity verification submission and review
//
// @tag.name                    Uploads
// @tag.description             S3 presigned upload URL generation
//
// @tag.name                    Tests
// @tag.description             Q Bank, Test Series, Practice — student access
//
// @tag.name                    Attempts
// @tag.description             Student test attempts, answers, scoring, and review
//
// @tag.name                    Teacher
// @tag.description             Teacher content creation and management
//
// @tag.name                    Admin
// @tag.description             Platform administration endpoints
//
// @tag.name                    Wellness
// @tag.description             Mental well-being content
package docs
